// 汎用ユーティリティ関数
// 外部ライブラリは使用しない（原則: 不要なライブラリを導入しない）

export function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // crypto.randomUUID が使えない古い環境向けの簡易フォールバック。
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowISO() {
  return new Date().toISOString();
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const pad2 = (n) => String(n).padStart(2, '0');

// 日付表示は端末のロケール設定に依存しない固定書式（YYYY/MM/DD）にする。
// 表の列幅が安定し、年をまたぐ記録も一目で比較できる。
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function splitCsv(str) {
  if (!str) return [];
  return str
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// URLのハッシュに埋め込むIDのエンコード／デコード。
// 通常はUUIDなのでそのまま通るが、インポートしたデータのIDに
// 記号が含まれていてもルーティングが壊れないようにしておく。
export const enc = (id) => encodeURIComponent(id);
export const dec = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// 検索用の正規化（全角/半角・大文字小文字の差を吸収）
export function normalizeForSearch(s) {
  return String(s ?? '').normalize('NFKC').toLowerCase();
}
