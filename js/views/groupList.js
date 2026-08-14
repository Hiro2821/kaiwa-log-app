import { listGroups, addGroup } from '../db/groups.js';
import { escapeHtml } from '../lib/util.js';

export async function renderGroupList(root) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;
  const groups = await listGroups();

  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <a href="#/" class="back-link" aria-label="戻る">←</a>
        <h1>グループ</h1>
      </header>
      <button id="add-group-btn" class="secondary-button full-width">＋ 新しいグループを追加</button>
      ${
        groups.length
          ? `<ul class="entity-list">${groups
              .map(
                (g) => `<li><a href="#/groups/${g.id}" class="entity-list__item">
                  <span class="entity-list__name">${escapeHtml(g.name)}</span>
                  ${g.memo ? `<span class="entity-list__memo">${escapeHtml(g.memo)}</span>` : ''}
                </a></li>`
              )
              .join('')}</ul>`
          : `<p class="empty-state">まだグループが登録されていません。</p>`
      }
    </div>
  `;

  root.querySelector('#add-group-btn').addEventListener('click', async () => {
    const name = prompt('グループの名前を入力してください');
    if (!name || !name.trim()) return;
    try {
      await addGroup({ name });
      renderGroupList(root);
    } catch (e) {
      alert(e.message);
    }
  });
}
