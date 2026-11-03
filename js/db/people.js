import { getDB } from './database.js';
import { promisifyRequest, promisifyTx } from '../lib/idbHelpers.js';
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

// 人物を削除し、その人物への紐付けだけを記録から外す。
// 会話記録そのもの（本文・タイトル・日時・ゴミ箱内のものを含む）は一切削除しない。
// 記録側に存在しない人物IDが残ると「未分類」の扱いが不整合になるため、
// 人物の削除と紐付けの解除は1つのトランザクションで行い、途中で失敗した場合は
// どちらも反映されない（アトミック）ようにしている。
// 紐付け解除は内容の編集ではないため、記録の updatedAt は変更しない。
export async function deletePersonCascade(id) {
  const db = await getDB();
  const tx = db.transaction(['people', 'records'], 'readwrite');
  const done = promisifyTx(tx);
  const peopleStore = tx.objectStore('people');
  const recordsStore = tx.objectStore('records');

  const all = await promisifyRequest(recordsStore.getAll());
  for (const r of all) {
    if (Array.isArray(r.personIds) && r.personIds.includes(id)) {
      r.personIds = r.personIds.filter((pid) => pid !== id);
      recordsStore.put(r);
    }
  }
  peopleStore.delete(id);
  await done;
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
