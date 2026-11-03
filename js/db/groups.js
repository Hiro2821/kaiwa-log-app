import { getDB } from './database.js';
import { promisifyRequest, promisifyTx } from '../lib/idbHelpers.js';
import { uuid, nowISO } from '../lib/util.js';

const STORE = 'groups';

export async function addGroup({ name, memo = '' }) {
  if (!name || !name.trim()) throw new Error('グループの名前を入力してください。');
  const db = await getDB();
  const group = { id: uuid(), name: name.trim(), memo: memo.trim(), createdAt: nowISO() };
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await promisifyRequest(store.add(group));
  return group;
}

export async function updateGroup(id, patch) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const existing = await promisifyRequest(store.get(id));
  if (!existing) throw new Error('グループが見つかりませんでした。');
  const updated = { ...existing, ...patch };
  await promisifyRequest(store.put(updated));
  return updated;
}

export async function deleteGroup(id) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await promisifyRequest(store.delete(id));
}

// グループを削除し、そのグループへの紐付けだけを記録から外す（記録自体は削除しない）。
// 詳細は people.js の deletePersonCascade を参照。
export async function deleteGroupCascade(id) {
  const db = await getDB();
  const tx = db.transaction(['groups', 'records'], 'readwrite');
  const done = promisifyTx(tx);
  const groupsStore = tx.objectStore('groups');
  const recordsStore = tx.objectStore('records');

  const all = await promisifyRequest(recordsStore.getAll());
  for (const r of all) {
    if (Array.isArray(r.groupIds) && r.groupIds.includes(id)) {
      r.groupIds = r.groupIds.filter((gid) => gid !== id);
      recordsStore.put(r);
    }
  }
  groupsStore.delete(id);
  await done;
}

export async function getGroup(id) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  return promisifyRequest(store.get(id));
}

export async function listGroups() {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const all = await promisifyRequest(store.getAll());
  return all.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}
