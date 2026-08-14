import { listAllRecords } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { listGroups } from '../db/groups.js';
import { setSetting } from '../db/settings.js';
import { getDB } from '../db/database.js';
import { promisifyRequest, promisifyTx } from './idbHelpers.js';
import { nowISO } from './util.js';

export async function buildBackupObject() {
  const [people, groups, records] = await Promise.all([
    listPeople(),
    listGroups(),
    listAllRecords({ includeDeleted: true }), // ゴミ箱内の記録も含めて完全にバックアップする
  ]);
  return {
    appName: 'kaiwa-log',
    exportedAt: nowISO(),
    schemaVersion: 1,
    people,
    groups,
    records,
  };
}

// JSONファイルとして書き出す。外部サーバーへの送信は一切行わない。
export async function exportBackup() {
  const data = await buildBackupObject();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = data.exportedAt.replace(/[:.]/g, '-');
  a.href = url;
  a.download = `kaiwa-log-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await setSetting('lastBackupAt', data.exportedAt);
  return data;
}

function validateBackupShape(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.people) &&
    Array.isArray(data.groups) &&
    Array.isArray(data.records)
  );
}

// バックアップJSONを読み込む。
//
// mode には次の2種類があり、どちらを行うかで結果が大きく異なるため、
// 呼び出し側（設定画面）でも明確に区別してユーザーに提示すること。
//
//   'merge'   … 「追加読み込み」。現在のデータは残したまま、
//               バックアップに含まれるデータを追加・上書きする
//               （同じIDのものは上書き、それ以外の既存データはそのまま残る）。
//   'replace' … 「バックアップから復元」。現在の人物・グループ・記録を
//               いったんすべて削除してから、バックアップの内容だけにする
//               （バックアップに存在しない現在のデータは失われる、破壊的な操作）。
export async function importBackup(jsonText, { mode = 'merge' } = {}) {
  if (mode !== 'merge' && mode !== 'replace') {
    throw new Error(`不正なmode指定です: ${mode}`);
  }

  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('JSONの読み込みに失敗しました。ファイルが壊れている可能性があります。');
  }
  if (!validateBackupShape(data)) {
    throw new Error('バックアップファイルの形式が正しくありません。');
  }

  const db = await getDB();
  const tx = db.transaction(['people', 'groups', 'records'], 'readwrite');
  const peopleStore = tx.objectStore('people');
  const groupsStore = tx.objectStore('groups');
  const recordsStore = tx.objectStore('records');

  if (mode === 'replace') {
    // 「復元」は現在のデータをバックアップの内容に完全に置き換える。
    // settings（最終バックアップ日時など、会話データではないアプリ内部設定）は対象外。
    await promisifyRequest(peopleStore.clear());
    await promisifyRequest(groupsStore.clear());
    await promisifyRequest(recordsStore.clear());
  }

  for (const p of data.people) await promisifyRequest(peopleStore.put(p));
  for (const g of data.groups) await promisifyRequest(groupsStore.put(g));
  for (const r of data.records) await promisifyRequest(recordsStore.put(r));

  await promisifyTx(tx);

  return {
    mode,
    peopleCount: data.people.length,
    groupsCount: data.groups.length,
    recordsCount: data.records.length,
  };
}
