// IndexedDBの接続・スキーマ定義・マイグレーション機構。
//
// マイグレーションは、独自の「schemaVersionをmetaストアに保存する仕組み」を
// 自作するのではなく、IndexedDBが標準で備えている db.version / onupgradeneeded を
// そのまま利用する。これにより、将来スキーマを変更する際は
//   1. DB_VERSION を1つ上げる
//   2. onupgradeneeded 内に `if (oldVersion < 新バージョン) { ... }` を追記する
// だけで、既存データを保持したままストア・インデックスの追加や
// データ変換ができる（IndexedDBの正式な仕組みであり、独自実装より信頼できる）。

import { uuid } from '../lib/util.js';

export const DB_NAME = 'kaiwa-log-db';
export const DB_VERSION = 2;

let dbPromise = null;

export function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('このブラウザはIndexedDBに対応していません。'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // --- v1: 初期スキーマ ---
      if (oldVersion < 1) {
        const records = db.createObjectStore('records', { keyPath: 'id' });
        records.createIndex('createdAt', 'createdAt');
        // personIds / groupIds は配列フィールド。multiEntryインデックスにより
        // 「この人物の記録一覧」「このグループの記録一覧」を高速に取得できる。
        // ただし、空配列（人物・グループどちらにも紐付かない記録）はmultiEntry
        // インデックスには載らない仕様のため、未分類記録の一覧取得は
        // records ストア全件を取得したうえでJS側でフィルタする方式にしている
        // （詳細は js/db/records.js の listUnassignedRecords を参照）。
        records.createIndex('personIds', 'personIds', { multiEntry: true });
        records.createIndex('groupIds', 'groupIds', { multiEntry: true });

        const people = db.createObjectStore('people', { keyPath: 'id' });
        people.createIndex('name', 'name');

        const groups = db.createObjectStore('groups', { keyPath: 'id' });
        groups.createIndex('name', 'name');

        // アプリ内部の小さな設定値（最終バックアップ日時など）を保存するストア。
        // 会話データそのものは含まない。
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // --- v2: 「次回確認したいこと」に完了状態を追加 ---
      // nextTimeNotes を 文字列の配列 から
      // { id, text, done, doneAt } の配列 に変換する。
      // ストア構造（キー・インデックス）自体は変わらないため、
      // createObjectStore / createIndex は不要で、既存レコードの
      // 中身だけをカーソルで走査して書き換える。
      if (oldVersion < 2) {
        const records = event.target.transaction.objectStore('records');
        records.openCursor().onsuccess = (cursorEvent) => {
          const cursor = cursorEvent.target.result;
          if (!cursor) return; // 走査終了
          const record = cursor.value;
          const notes = record.nextTimeNotes;
          if (Array.isArray(notes) && notes.length > 0 && typeof notes[0] === 'string') {
            record.nextTimeNotes = notes.map((text) => ({
              id: uuid(),
              text,
              done: false,
              doneAt: null,
            }));
            cursor.update(record);
          } else if (!Array.isArray(notes)) {
            // 万一 nextTimeNotes が存在しない/壊れている場合の保険
            record.nextTimeNotes = [];
            cursor.update(record);
          }
          cursor.continue();
        };
      }

      // --- 将来のスキーマ変更はここに追記する ---
      // 例:
      // if (oldVersion < 3) {
      //   const records = event.target.transaction.objectStore('records');
      //   records.createIndex('newField', 'newField');
      // }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      // 他のタブ/ウィンドウで旧バージョンのDB接続が開いたままだと発生しうる。
      // 個人利用のPWAでは頻度は低いと想定されるが、発生した場合はコンソールに警告を出す。
      console.warn(
        'IndexedDBのアップグレードがブロックされました。他のタブでこのアプリを開いていないか確認してください。'
      );
    };
  });

  return dbPromise;
}

export function getDB() {
  return initDB();
}
