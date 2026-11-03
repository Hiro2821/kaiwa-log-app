import { listTrashedRecords, restoreRecord, permanentlyDeleteRecord } from '../db/records.js';
import { escapeHtml, formatDate, formatDateTime } from '../lib/util.js';
import { backLinkHTML, emptyHTML } from './shared.js';
import { showConfirmModal } from './modal.js';

export async function renderTrash(root) {
  const trashed = await listTrashedRecords();

  root.innerHTML = `
    <div class="page">
      <header class="page-header page-header--nav">${backLinkHTML('#/settings', 'データ管理')}</header>
      <header class="page-header"><h1 class="page-title">ゴミ箱</h1></header>
      ${
        trashed.length
          ? `<p class="body-note">削除した記録です。元に戻すか、完全に削除できます。</p>
             <ul class="trash-list">${trashed
               .map(
                 (r) => `<li class="trash-item">
                   <div class="trash-item__main">
                     <div class="trash-item__title">${escapeHtml(r.title || '（無題）')}</div>
                     <div class="trash-item__meta">記録日 ${escapeHtml(formatDate(r.createdAt))} ・ 削除 ${escapeHtml(formatDateTime(r.deletedAt))}</div>
                   </div>
                   <div class="trash-item__actions">
                     <button type="button" class="btn btn--secondary btn--small" data-restore="${escapeHtml(r.id)}">元に戻す</button>
                     <button type="button" class="btn btn--danger-text btn--small" data-purge="${escapeHtml(r.id)}">完全に削除</button>
                   </div>
                 </li>`
               )
               .join('')}</ul>`
          : emptyHTML('ゴミ箱は空です。')
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
      const ok = await showConfirmModal({
        title: 'この記録を完全に削除しますか？',
        message: '完全に削除すると元に戻せません。',
        confirmLabel: '完全に削除',
        danger: true,
      });
      if (!ok) return;
      await permanentlyDeleteRecord(btn.dataset.purge);
      renderTrash(root);
    })
  );
}
