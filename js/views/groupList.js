import { listGroups, addGroup } from '../db/groups.js';
import { listAllRecords } from '../db/records.js';
import { escapeHtml, enc } from '../lib/util.js';
import { backLinkHTML, bindRowLinks, emptyHTML } from './shared.js';
import { showGroupFormModal, showInfoModal } from './modal.js';

// グループ一覧。グループは以前のバージョンで作られたデータで、新しい記録フォームでは
// 選択しないが、既存データを確認・整理できるようデータ管理画面から開けるようにしている。
export async function renderGroupList(root) {
  const [groups, records] = await Promise.all([listGroups(), listAllRecords()]);
  const counts = new Map();
  for (const r of records) for (const gid of r.groupIds || []) counts.set(gid, (counts.get(gid) || 0) + 1);

  root.innerHTML = `
    <div class="page">
      <header class="page-header page-header--nav">${backLinkHTML('#/settings', 'データ管理')}</header>
      <header class="page-header">
        <h1 class="page-title">グループ</h1>
        <button type="button" class="header-button" id="add-group-btn">＋ 追加</button>
      </header>
      ${
        groups.length
          ? `<div class="table-wrap"><table class="table table--groups">
              <thead><tr>
                <th scope="col" class="col-name">グループ名</th>
                <th scope="col" class="col-count">記録数</th>
                <th scope="col" class="col-memo">メモ</th>
              </tr></thead>
              <tbody>${groups
                .map((g) => {
                  const href = `#/groups/${enc(g.id)}`;
                  return `<tr data-href="${href}">
                    <td class="col-name"><a href="${href}"><span class="clamp">${escapeHtml(g.name)}</span></a></td>
                    <td class="col-count">${counts.get(g.id) || 0}</td>
                    <td class="col-memo"><span class="clamp">${g.memo ? escapeHtml(g.memo) : ''}</span></td>
                  </tr>`;
                })
                .join('')}</tbody>
            </table></div>`
          : emptyHTML('グループはありません。')
      }
    </div>
  `;

  bindRowLinks(root);

  root.querySelector('#add-group-btn').addEventListener('click', async () => {
    const result = await showGroupFormModal({ title: 'グループを追加', confirmLabel: '追加' });
    if (!result) return;
    try {
      await addGroup(result);
      renderGroupList(root);
    } catch (e) {
      await showInfoModal({ title: 'エラー', message: e.message });
    }
  });
}
