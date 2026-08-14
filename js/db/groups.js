import { getDB } from './database.js';
import { promisifyRequest } from '../lib/idbHelpers.js';
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
