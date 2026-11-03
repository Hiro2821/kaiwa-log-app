import { getGroup, updateGroup, deleteGroupCascade } from '../db/groups.js';
import { listRecordsByGroup } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { escapeHtml, formatDate } from '../lib/util.js';
import { backLinkHTML, recordTableHTML, bindRowLinks, emptyHTML } from './shared.js';
import { showGroupFormModal, showConfirmModal, showInfoModal } from './modal.js';

export async function renderGroupDetail(root, id) {
  const group = await getGroup(id);
  if (!group) {
    root.innerHTML = `
      <div class="page">
        <header class="page-header page-header--nav">${backLinkHTML('#/groups', 'グループ')}</header>
        ${emptyHTML('グループが見つかりませんでした。')}
      </div>`;
    return;
  }

  const [records, people] = await Promise.all([listRecordsByGroup(id), listPeople()]);
  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
  const last = records.length ? records[0].createdAt : null;
  const from = `group:${id}`;

  root.innerHTML = `
    <div class="page">
      <header class="page-header page-header--nav">
        ${backLinkHTML('#/groups', 'グループ')}
        <button type="button" class="header-button" id="edit-group-btn">編集</button>
      </header>

      <h1 class="detail-title">${escapeHtml(group.name)}</h1>
      ${group.memo ? `<p class="detail-memo">${escapeHtml(group.memo)}</p>` : ''}

      <dl class="facts">
        <div class="facts__item"><dt>会話記録</dt><dd>${records.length}件</dd></div>
        <div class="facts__item"><dt>最終記録日</dt><dd>${last ? escapeHtml(formatDate(last)) : '—'}</dd></div>
      </dl>

      <section class="section">
        <h2 class="section__title">会話履歴</h2>
        ${
          records.length
            ? recordTableHTML(records, { peopleById, showPeople: true, from })
            : emptyHTML('このグループの会話記録はありません。')
        }
      </section>

      <section class="section section--danger-zone">
        <div class="actions">
          <button type="button" class="btn btn--danger-text btn--block" id="delete-group-btn">このグループを削除</button>
        </div>
      </section>
    </div>
  `;

  bindRowLinks(root);

  root.querySelector('#edit-group-btn').addEventListener('click', async () => {
    const result = await showGroupFormModal({ title: 'グループを編集', name: group.name, memo: group.memo || '' });
    if (!result) return;
    try {
      await updateGroup(id, { name: result.name, memo: result.memo });
      renderGroupDetail(root, id);
    } catch (e) {
      await showInfoModal({ title: 'エラー', message: e.message });
    }
  });

  root.querySelector('#delete-group-btn').addEventListener('click', async () => {
    const linked = await listRecordsByGroup(id, { includeDeleted: true });
    const ok = await showConfirmModal({
      title: `「${group.name}」を削除しますか？`,
      message:
        (linked.length
          ? `このグループに紐づく会話記録（${linked.length}件）は削除されません。記録からグループの紐付けだけが外れます。`
          : 'このグループに紐づく会話記録はありません。') + 'この操作は元に戻せません。',
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteGroupCascade(id);
      location.hash = '#/groups';
    } catch (e) {
      await showInfoModal({ title: '削除に失敗しました', message: e.message });
    }
  });
}
