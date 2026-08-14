// IndexedDBのIDBRequestをPromiseに変換する薄いヘルパー。
// これ以上の抽象化（ORM的な仕組みなど）はPhase 1では行わない（過剰な抽象化を避ける方針）。

export function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function promisifyTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
