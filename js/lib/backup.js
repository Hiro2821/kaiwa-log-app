// バックアップ（JSONエクスポート／インポート）。
//
// 【形式の互換性】
// エクスポート形式は従来から変更していない:
//   { appName, exportedAt, schemaVersion, people, groups, records }
// 人物・グループ・記録はIndexedDBに保存されている内容をそのまま書き出す
// （IDも日時も本文も、アプリが知らないフィールドも含めて欠落させない）。
//
// 【インポートの安全方針】
// インポートはデータを「削除しない」。clear() も delete() も一切呼ばない。
//   1. planImport()  … ファイルを解析し、現在のデータと突き合わせた結果（計画）を返す。
//                      この段階ではデータベースを一切変更しない。
//   2. applyImport() … ユーザーが計画を確認・承認したあとにのみ呼ぶ。
//                      1つのトランザクションで、新規データの追加（と、指定時のみ更新）を行う。
//                      途中で失敗した場合はすべて取り消される（アトミック）。

import { getDB } from '../db/database.js';
import { setSetting } from '../db/settings.js';
import { promisifyRequest, promisifyTx } from './idbHelpers.js';
import { nowISO, uuid } from './util.js';

export const BACKUP_APP_NAME = 'kaiwa-log';
export const BACKUP_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------
// エクスポート
// ---------------------------------------------------------------

async function readAllStores() {
  const db = await getDB();
  const tx = db.transaction(['people', 'groups', 'records'], 'readonly');
  const [people, groups, records] = await Promise.all(
    ['people', 'groups', 'records'].map((name) => promisifyRequest(tx.objectStore(name).getAll()))
  );
  return { people, groups, records };
}

export async function buildBackupObject() {
  const { people, groups, records } = await readAllStores();
  people.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja'));
  groups.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja'));
  // ゴミ箱内の記録も含めて完全にバックアップする
  records.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  return {
    appName: BACKUP_APP_NAME,
    exportedAt: nowISO(),
    schemaVersion: BACKUP_SCHEMA_VERSION,
    people,
    groups,
    records,
  };
}

// ファイルを端末に渡す。iOSでは共有シート（「ファイルに保存」など）を優先し、
// 使えない環境ではダウンロードにフォールバックする。外部サーバーへの送信は一切行わない。
async function deliverFile(file) {
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'; // ユーザーが共有シートを閉じた
      // それ以外（ユーザー操作扱いが切れた等）はダウンロードにフォールバック
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

// 戻り値: { data, method }  method は 'shared' | 'downloaded' | 'cancelled'
// キャンセルされた場合は「最終バックアップ日時」を更新しない。
export async function exportBackup() {
  const data = await buildBackupObject();
  const json = JSON.stringify(data, null, 2);
  const stamp = data.exportedAt.replace(/[:.]/g, '-');
  const file = new File([json], `kaiwa-log-backup-${stamp}.json`, { type: 'application/json' });
  const method = await deliverFile(file);
  if (method !== 'cancelled') await setSetting('lastBackupAt', data.exportedAt);
  return { data, method };
}

// ---------------------------------------------------------------
// インポート: 解析・正規化
// ---------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// キー順に依存しない比較用の文字列化
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

// 古い形式（文字列の配列）の nextTimeNotes を現行形式 { id, text, done, doneAt } に揃える。
function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map((n) => {
    if (typeof n === 'string') return { id: uuid(), text: n, done: false, doneAt: null };
    return n;
  });
}

// 欠けている項目に既定値を補うだけで、既存の値は一切変更しない。
function normalizePerson(p) {
  return {
    ...p,
    id: String(p.id),
    name: typeof p.name === 'string' ? p.name : p.name == null ? '' : String(p.name),
    memo: typeof p.memo === 'string' ? p.memo : '',
  };
}

function normalizeRecord(r, fallbackDate, counters) {
  const out = { ...r, id: String(r.id) };
  if (typeof out.text !== 'string') {
    out.text = out.text == null ? '' : String(out.text);
    counters.missingText += 1;
  }
  if (typeof out.title !== 'string') out.title = out.title == null ? null : String(out.title);
  for (const key of ['personIds', 'groupIds', 'topics', 'keyPoints']) {
    if (!Array.isArray(out[key])) out[key] = [];
  }
  out.nextTimeNotes = normalizeNotes(out.nextTimeNotes);
  if (!('rawVoiceText' in out)) out.rawVoiceText = null;
  if (!('deletedAt' in out)) out.deletedAt = null;
  if (!out.createdAt) {
    out.createdAt = out.updatedAt || fallbackDate || nowISO();
    counters.missingCreatedAt += 1;
  }
  if (!out.updatedAt) out.updatedAt = out.createdAt;
  return out;
}

// 1ファイル内でIDが重複している場合は、更新日時が新しい方（同じなら後ろの方）を残す。
function dedupeById(items, warnings, label) {
  const map = new Map();
  let dup = 0;
  for (const item of items) {
    const prev = map.get(item.id);
    if (prev) {
      dup += 1;
      if (String(item.updatedAt ?? '') >= String(prev.updatedAt ?? '')) map.set(item.id, item);
    } else {
      map.set(item.id, item);
    }
  }
  if (dup > 0) warnings.push(`ファイル内で同じIDの${label}が${dup}件重複していたため、新しい方を採用します。`);
  return [...map.values()];
}

function requireArray(data, key, { optional = false, warnings } = {}) {
  if (data[key] === undefined && optional) {
    warnings.push(`ファイルに「${key}」がありません。空として扱います。`);
    return [];
  }
  if (!Array.isArray(data[key])) {
    throw new Error(`バックアップファイルの形式が正しくありません（「${key}」が見つかりません）。`);
  }
  data[key].forEach((item, i) => {
    if (!isPlainObject(item)) {
      throw new Error(`バックアップファイルの形式が正しくありません（${key}[${i}] が不正です）。`);
    }
    if (item.id === undefined || item.id === null || String(item.id) === '') {
      throw new Error(`バックアップファイルの形式が正しくありません（${key}[${i}] にIDがありません）。`);
    }
  });
  return data[key];
}

export function parseBackup(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('JSONの読み込みに失敗しました。ファイルが壊れている可能性があります。');
  }
  if (!isPlainObject(data)) {
    throw new Error('バックアップファイルの形式が正しくありません。');
  }

  const warnings = [];
  if (data.appName !== undefined && data.appName !== BACKUP_APP_NAME) {
    warnings.push(`別のアプリ（${String(data.appName)}）のファイルの可能性があります。`);
  }
  if (typeof data.schemaVersion === 'number' && data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    warnings.push('このアプリより新しい形式のファイルです。一部の項目が正しく扱えない可能性があります。');
  }

  const rawPeople = requireArray(data, 'people', { warnings });
  const rawGroups = requireArray(data, 'groups', { optional: true, warnings });
  const rawRecords = requireArray(data, 'records', { warnings });

  const counters = { missingText: 0, missingCreatedAt: 0 };
  const people = dedupeById(rawPeople.map(normalizePerson), warnings, '人物');
  const groups = dedupeById(rawGroups.map(normalizePerson), warnings, 'グループ');
  const records = dedupeById(
    rawRecords.map((r) => normalizeRecord(r, data.exportedAt, counters)),
    warnings,
    '記録'
  );
  if (counters.missingText) warnings.push(`本文がない記録が${counters.missingText}件あります（空の本文として取り込みます）。`);
  if (counters.missingCreatedAt) warnings.push(`作成日時がない記録が${counters.missingCreatedAt}件あります（更新日時などで補います）。`);

  return {
    meta: {
      appName: data.appName ?? null,
      exportedAt: data.exportedAt ?? null,
      schemaVersion: data.schemaVersion ?? null,
    },
    people,
    groups,
    records,
    warnings,
  };
}

// ---------------------------------------------------------------
// インポート: 計画（現在のデータとの突き合わせ。DBは変更しない）
// ---------------------------------------------------------------

function classifyById(incoming, existingById) {
  const add = [];
  const identical = [];
  const conflicts = [];
  for (const item of incoming) {
    const existing = existingById.get(item.id);
    if (!existing) add.push(item);
    else if (stableStringify(item) === stableStringify(existing)) identical.push(item);
    else conflicts.push({ incoming: item, existing });
  }
  return { add, identical, conflicts };
}

export async function planImport(jsonText) {
  const parsed = parseBackup(jsonText);
  const current = await readAllStores();

  // 比較のため、現在のデータにも取り込み側と同じ正規化（欠けた項目に既定値を補う）をかける。
  // こうしておかないと、古い記録で項目が欠けているだけで「内容が異なる」と誤判定される。
  // ここで作る正規化済みの値は比較専用で、データベースには書き戻さない。
  const scratch = { missingText: 0, missingCreatedAt: 0 };
  const peopleById = new Map(current.people.map((p) => [String(p.id), normalizePerson(p)]));
  const groupsById = new Map(current.groups.map((g) => [String(g.id), normalizePerson(g)]));
  const recordsById = new Map(current.records.map((r) => [String(r.id), normalizeRecord(r, null, scratch)]));

  const people = classifyById(parsed.people, peopleById);
  const groups = classifyById(parsed.groups, groupsById);
  const recordsByIdResult = classifyById(parsed.records, recordsById);

  // IDは違うが「作成日時と本文が完全に同じ」記録は、同じ会話の二重取り込みとみなして追加しない。
  // （別端末で作り直されたデータなどで起こりうる。作成日時はミリ秒精度のため偶然の一致は考えにくい）
  const contentKey = (r) => `${r.createdAt}\u0000${r.text}`;
  const existingContentKeys = new Set(current.records.map(contentKey));
  const addRecords = [];
  const contentDuplicates = [];
  for (const r of recordsByIdResult.add) {
    if (r.text && existingContentKeys.has(contentKey(r))) contentDuplicates.push(r);
    else addRecords.push(r);
  }

  const warnings = [...parsed.warnings];

  // 同名の人物は別IDのため別人物として追加される。気づけるよう知らせる。
  const existingNames = new Set(current.people.map((p) => String(p.name ?? '').trim()).filter(Boolean));
  const sameName = people.add.filter((p) => existingNames.has(p.name.trim())).length;
  if (sameName > 0) {
    warnings.push(
      `既存の人物と同じ名前の人物が${sameName}人います。IDが違うため別の人物として追加されます（取り込み後、人物詳細の「他の人物と統合」で一つにまとめられます）。`
    );
  }

  // 取り込み後に、存在しない人物IDを参照する記録がないかの確認
  const knownPersonIds = new Set([...peopleById.keys(), ...people.add.map((p) => p.id)]);
  const orphanRefs = addRecords.filter((r) => r.personIds.some((id) => !knownPersonIds.has(String(id)))).length;
  if (orphanRefs > 0) {
    warnings.push(`存在しない人物を参照している記録が${orphanRefs}件あります（その人物は「未設定」として扱われます）。`);
  }

  return {
    meta: parsed.meta,
    warnings,
    people: { add: people.add, identical: people.identical, conflicts: people.conflicts },
    groups: { add: groups.add, identical: groups.identical, conflicts: groups.conflicts },
    records: {
      add: addRecords,
      identical: recordsByIdResult.identical,
      conflicts: recordsByIdResult.conflicts,
      contentDuplicates,
    },
    // 追加も更新も何も起きないか
    isEmpty:
      people.add.length + groups.add.length + addRecords.length === 0 &&
      people.conflicts.length + groups.conflicts.length + recordsByIdResult.conflicts.length === 0,
    hasConflicts: recordsByIdResult.conflicts.length > 0,
  };
}

// ---------------------------------------------------------------
// インポート: 適用（削除は一切行わない）
// ---------------------------------------------------------------

// onConflict:
//   'skip'  … 同じIDで内容が異なる記録は、現在のデータを残す（既定・推奨）
//   'newer' … 同じIDで内容が異なる記録は、更新日時が新しい方を採用する
// 人物・グループは更新日時を持たないため、どちらの場合も現在のデータを残す。
export async function applyImport(plan, { onConflict = 'skip' } = {}) {
  if (onConflict !== 'skip' && onConflict !== 'newer') {
    throw new Error(`不正な指定です: ${onConflict}`);
  }

  const db = await getDB();
  const tx = db.transaction(['people', 'groups', 'records'], 'readwrite');
  const done = promisifyTx(tx);
  const peopleStore = tx.objectStore('people');
  const groupsStore = tx.objectStore('groups');
  const recordsStore = tx.objectStore('records');

  // add() は同じIDが既にあると失敗してトランザクション全体を取り消す。
  // 計画の作成後に別のタブなどでデータが増えていても、誤って上書きしないための安全装置。
  for (const p of plan.people.add) peopleStore.add(p);
  for (const g of plan.groups.add) groupsStore.add(g);
  for (const r of plan.records.add) recordsStore.add(r);

  let updated = 0;
  if (onConflict === 'newer') {
    for (const { incoming, existing } of plan.records.conflicts) {
      if (String(incoming.updatedAt ?? '') > String(existing.updatedAt ?? '')) {
        recordsStore.put(incoming);
        updated += 1;
      }
    }
  }

  await done;

  return {
    added: {
      people: plan.people.add.length,
      groups: plan.groups.add.length,
      records: plan.records.add.length,
    },
    updatedRecords: updated,
    skippedRecords:
      plan.records.identical.length +
      plan.records.contentDuplicates.length +
      (plan.records.conflicts.length - updated),
  };
}
