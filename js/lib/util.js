// 汎用ユーティリティ関数
// 外部ライブラリは使用しない（原則: 不要なライブラリを導入しない）

export function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // crypto.randomUUID が使えない古い環境向けの簡易フォールバック。
  // iPhone 17 / iOS 26 では基本的に crypto.randomUUID が使える想定だが、
  // 万一使えない場合に備えて用意している（要検証: 実機での crypto.randomUUID 利用可否）。
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

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function splitCsv(str) {
  if (!str) return [];
  return str
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
