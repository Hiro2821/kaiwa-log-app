import { listPeople, addPerson } from '../db/people.js';
import { escapeHtml } from '../lib/util.js';

export async function renderPersonList(root) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;
  const people = await listPeople();

  root.innerHTML = `
    <div class="view">
      <header class="view-header">
        <a href="#/" class="back-link" aria-label="戻る">←</a>
        <h1>人物</h1>
      </header>
      <button id="add-person-btn" class="secondary-button full-width">＋ 新しい人物を追加</button>
      ${
        people.length
          ? `<ul class="entity-list">${people
              .map(
                (p) => `<li><a href="#/people/${p.id}" class="entity-list__item">
                  <span class="entity-list__name">${escapeHtml(p.name)}</span>
                  ${p.memo ? `<span class="entity-list__memo">${escapeHtml(p.memo)}</span>` : ''}
                </a></li>`
              )
              .join('')}</ul>`
          : `<p class="empty-state">まだ人物が登録されていません。</p>`
      }
    </div>
  `;

  root.querySelector('#add-person-btn').addEventListener('click', async () => {
    const name = prompt('人物の名前を入力してください');
    if (!name || !name.trim()) return;
    try {
      await addPerson({ name });
      renderPersonList(root);
    } catch (e) {
      alert(e.message);
    }
  });
}
