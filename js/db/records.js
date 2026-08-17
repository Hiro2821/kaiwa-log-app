import { getDB } from './database.js';
import { promisifyRequest } from '../lib/idbHelpers.js';
import { uuid, nowISO } from '../lib/util.js';

const STORE = 'records';

function normalizeIds(ids) {
  return [...new Set((ids || []).filter(Boolean))];
}

export async function addRecord({
  text,
  personIds = [],
  groupIds = [],
  topics = [],
  keyPoints = [],
  nextTimeNotes = [],
  title = null,
  rawVoiceText = null,
}) {
  if (!text || !text.trim()) throw new Error('内容を入力してください。');
  const db = await getDB();
  const now = nowISO();
  const record = {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    // 人物・グループはどちらも任意。空配列も正常なデータとして扱う。
    personIds: normalizeIds(personIds),
    groupIds: normalizeIds(groupIds),
    text: text.trim(),
    rawVoiceText,
    topics,
    keyPoints,
    nextTimeNotes,
    title,
    deletedAt: null,
  };
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await promisifyRequest(store.add(record));
  return record;
}

export async function updateRecord(id, patch) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const existing = await promisifyRequest(store.get(id));
  if (!existing) throw new Error('記録が見つかりませんでした。');
  const updated = {
    ...existing,
    ...patch,
    personIds: patch.personIds ? normalizeIds(patch.personIds) : existing.personIds,
    groupIds: patch.groupIds ? normalizeIds(patch.groupIds) : existing.groupIds,
    updatedAt: nowISO(),
  };
  await promisifyRequest(store.put(updated));
  return updated;
}

export async function softDeleteRecord(id) {
  return updateRecord(id, { deletedAt: nowISO() });
}

export async function restoreRecord(id) {
  return updateRecord(id, { deletedAt: null });
}

export async function permanentlyDeleteRecord(id) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await promisifyRequest(store.delete(id));
}

export async function getRecord(id) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  return promisifyRequest(store.get(id));
}

function sortByCreatedDesc(list) {
  return [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export async function listAllRecords({ includeDeleted = false } = {}) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const all = await promisifyRequest(store.getAll());
  const filtered = includeDeleted ? all : all.filter((r) => !r.deletedAt);
  return sortByCreatedDesc(filtered);
}

export async function listRecordsByPerson(personId, { includeDeleted = false } = {}) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const idx = store.index('personIds');
  const all = await promisifyRequest(idx.getAll(personId));
  const filtered = includeDeleted ? all : all.filter((r) => !r.deletedAt);
  return sortByCreatedDesc(filtered);
}

export async function listRecordsByGroup(groupId, { includeDeleted = false } = {}) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const idx = store.index('groupIds');
  const all = await promisifyRequest(idx.getAll(groupId));
  const filtered = includeDeleted ? all : all.filter((r) => !r.deletedAt);
  return sortByCreatedDesc(filtered);
}

// 人物にもグループにも紐付かない記録の一覧。
// multiEntryインデックスは空配列を対象にできないため、全件取得してJS側でフィルタする。
// 個人利用規模（数百〜数千件程度）を前提とした割り切り（設計書 v1.1 6章 参照）。
export async function listUnassignedRecords({ includeDeleted = false } = {}) {
  const all = await listAllRecords({ includeDeleted });
  return all.filter((r) => (r.personIds?.length ?? 0) === 0 && (r.groupIds?.length ?? 0) === 0);
}

export async function listTrashedRecords() {
  const all = await listAllRecords({ includeDeleted: true });
  return all
    .filter((r) => r.deletedAt)
    .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
}

// 人物・グループの統合（マージ）用: あるIDを別のIDに一括で付け替える。
export async function reassignPersonInRecords(fromId, toId) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const all = await promisifyRequest(store.getAll());
  for (const r of all) {
    if (r.personIds?.includes(fromId)) {
      r.personIds = normalizeIds(r.personIds.filter((id) => id !== fromId).concat(toId));
      r.updatedAt = nowISO();
      await promisifyRequest(store.put(r));
    }
  }
}

// 「次回確認したいこと」の完了状態を切り替える。
// nextTimeNotes は { id, text, done, doneAt } の配列（v2スキーマ）。
export async function toggleNextTimeNote(recordId, noteId) {
  const record = await getRecord(recordId);
  if (!record) throw new Error('記録が見つかりませんでした。');
  const notes = (record.nextTimeNotes || []).map((n) => {
    if (n.id !== noteId) return n;
    const nowDone = !n.done;
    return { ...n, done: nowDone, doneAt: nowDone ? new Date().toISOString() : null };
  });
  return updateRecord(recordId, { nextTimeNotes: notes });
}

export async function reassignGroupInRecords(fromId, toId) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const all = await promisifyRequest(store.getAll());
  for (const r of all) {
    if (r.groupIds?.includes(fromId)) {
      r.groupIds = normalizeIds(r.groupIds.filter((id) => id !== fromId).concat(toId));
      r.updatedAt = nowISO();
      await promisifyRequest(store.put(r));
    }
  }
}
