import { listTrashedRecords, restoreRecord, permanentlyDeleteRecord } from '../db/records.js';
import { escapeHtml, formatDateTime } from '../lib/util.js';

export async function renderTrash(root) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;
  const trashed = await listTrashedRecords();

  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <a href="#/settings" class="back-link" aria-label="戻る">←</a>
        <h1>ゴミ箱</h1>
      </header>
      ${
        trashed.length
          ? `<ul class="entity-list">${trashed
              .map(
                (r) => `<li class="trash-item">
                  <div>
                    <div class="entity-list__name">${escapeHtml(r.title || '（無題の記録）')}</div>
                    <div class="entity-list__memo">削除日時：${formatDateTime(r.deletedAt)}</div>
                  </div>
                  <div class="trash-item__actions">
                    <button class="secondary-button" data-restore="${r.id}">復元</button>
                    <button class="danger-button" data-purge="${r.id}">完全に削除</button>
                  </div>
                </li>`
              )
              .join('')}</ul>`
          : `<p class="empty-state">ゴミ箱は空です。</p>`
      }
    </div>
  `;

  root.querySelectorAll('[data-restore]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await restoreRecord(btn.dataset.restore);
      renderTrash(root);
    })
  );
  root.querySelectorAll('[data-purge]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('完全に削除すると元に戻せません。よろしいですか？')) return;
      await permanentlyDeleteRecord(btn.dataset.purge);
      renderTrash(root);
    })
  );
}
