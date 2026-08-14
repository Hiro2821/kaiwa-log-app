import { getRecord, softDeleteRecord, toggleNextTimeNote } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { listGroups } from '../db/groups.js';
import { escapeHtml, formatDateTime } from '../lib/util.js';

export async function renderRecordDetail(root, id) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;

  const [record, people, groups] = await Promise.all([getRecord(id), listPeople(), listGroups()]);

  if (!record) {
    root.innerHTML = `
      <div class="view">
        <p class="empty-state">記録が見つかりませんでした。削除された可能性があります。</p>
        <a href="#/" class="secondary-button full-width">ホームへ</a>
      </div>`;
    return;
  }

  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
  const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const names = [
    ...(record.personIds || []).map((pid) => peopleById[pid]?.name).filter(Boolean),
    ...(record.groupIds || []).map((gid) => groupsById[gid]?.name).filter(Boolean),
  ];

  root.innerHTML = `
    <div class="view view--detail">
      <header class="view-header">
        <a href="javascript:history.back()" class="back-link" aria-label="戻る">←</a>
        <h1>${escapeHtml(record.title || '（無題の記録）')}</h1>
      </header>

      <p class="detail-date">
        ${formatDateTime(record.createdAt)}${record.updatedAt !== record.createdAt ? '（編集済み）' : ''}
      </p>

      <div class="pill-row">
        ${names.length ? names.map((n) => `<span class="pill">${escapeHtml(n)}</span>`).join('') : '<span class="pill pill--muted">未分類</span>'}
      </div>

      <section class="detail-block">
        <h2>内容</h2>
        <p class="detail-text">${escapeHtml(record.text).replace(/\n/g, '<br>')}</p>
      </section>

      ${listBlock('話題', record.topics)}
      ${listBlock('重要事項', record.keyPoints)}
      ${nextTimeNotesBlock(record.nextTimeNotes)}

      <div class="form-actions">
        <a href="#/record/${record.id}/edit" class="secondary-button">編集</a>
        <button id="delete-btn" class="danger-button">ゴミ箱に移動</button>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-toggle-note]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await toggleNextTimeNote(record.id, btn.dataset.toggleNote);
      renderRecordDetail(root, record.id);
    });
  });

  root.querySelector('#delete-btn').addEventListener('click', async () => {
    if (!confirm('この記録をゴミ箱に移動しますか？ゴミ箱からいつでも復元できます。')) return;
    await softDeleteRecord(record.id);
    location.hash = '#/';
  });
}

function listBlock(label, items) {
  if (!items || !items.length) return '';
  return `<section class="detail-block">
    <h2>${escapeHtml(label)}</h2>
    <ul class="tag-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
  </section>`;
}

function nextTimeNotesBlock(notes) {
  if (!notes || !notes.length) return '';
  return `<section class="detail-block detail-block--flag">
    <h2>次回確認したいこと</h2>
    <ul class="tag-list">
      ${notes
        .map(
          (n) => `<li>
            <button type="button" class="next-note-toggle" data-toggle-note="${n.id}">
              <span class="next-note-toggle__box" aria-hidden="true">${n.done ? '✓' : '□'}</span>
              <span class="next-note-toggle__text ${n.done ? 'is-done' : ''}">${escapeHtml(n.text)}</span>
            </button>
          </li>`
        )
        .join('')}
    </ul>
  </section>`;
}
