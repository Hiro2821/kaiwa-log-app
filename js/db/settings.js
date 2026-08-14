import { getDB } from './database.js';
import { promisifyRequest } from '../lib/idbHelpers.js';

const STORE = 'settings';

export async function getSetting(key) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readonly').objectStore(STORE);
  const row = await promisifyRequest(store.get(key));
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  const db = await getDB();
  const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
  await promisifyRequest(store.put({ key, value }));
}
