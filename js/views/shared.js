import { escapeHtml, formatDateTime } from '../lib/util.js';

// 記録カード。人物・グループ名を表示したい場合は peopleById / groupsById を渡す。
// 人物詳細・グループ詳細画面など、文脈上すでに人物が分かっている場面では
// showTags: false を指定し、誤って「未分類」と表示されるのを防ぐ。
export function recordCardHTML(record, { peopleById = {}, groupsById = {}, showTags = true } = {}) {
  // カード左端のアンバー表示は「未完了の次回確認したいこと」がある場合のみ。
  // 完了済みしか残っていない記録は通常表示に戻す。
  const hasNext = (record.nextTimeNotes || []).some((n) => !n.done);

  let tagsHTML = '';
  if (showTags) {
    const names = [
      ...(record.personIds || []).map((id) => peopleById[id]?.name).filter(Boolean),
      ...(record.groupIds || []).map((id) => groupsById[id]?.name).filter(Boolean),
    ];
    tagsHTML = names.length
      ? `<div class="record-card__tags">${names.map((n) => `<span class="pill">${escapeHtml(n)}</span>`).join('')}</div>`
      : `<div class="record-card__tags"><span class="pill pill--muted">未分類</span></div>`;
  }

  const excerpt = (record.text || '').replace(/\s+/g, ' ').slice(0, 60);

  return `
    <a class="record-card ${hasNext ? 'record-card--flag' : ''}" href="#/record/${record.id}">
      <div class="record-card__title">${escapeHtml(record.title || '（無題の記録）')}</div>
      <div class="record-card__excerpt">${escapeHtml(excerpt)}</div>
      ${tagsHTML}
      <div class="record-card__date">${formatDateTime(record.createdAt)}</div>
    </a>`;
}
