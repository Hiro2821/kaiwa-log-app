import { getDB } from './database.js';
import { promisifyRequest } from '../lib/idbHelpers.js';
import { uuid, nowISO } from '../lib/util.js';

const STORE = 'people';

export async function addPerson({ name, memo = '' }) {
  if (!name || !name.trim()) throw new Error('人物の名前を入力してください。');
  const db = await getDB();
  const person = { id: uuid(), name: name.trim(), memo: memo.trim(), createdAt: nowISO() };
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await promisifyRequest(store.add(person));
  return person;
}

export async function updatePerson(id, patch) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  const existing = await promisifyRequest(store.get(id));
  if (!existing) throw new Error('人物が見つかりませんでした。');
  const updated = { ...existing, ...patch };
  await promisifyRequest(store.put(updated));
  return updated;
}

export async function deletePerson(id) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await promisifyRequest(store.delete(id));
}

export async function getPerson(id) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  return promisifyRequest(store.get(id));
}

export async function listPeople() {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const all = await promisifyRequest(store.getAll());
  return all.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}
