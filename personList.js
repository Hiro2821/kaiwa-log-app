import { listPeople, addPerson } from '../db/people.js';
import { escapeHtml } from '../lib/util.js';
import { showTextInputModal } from './modal.js';

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
                  <span class="entity-list__body">
                    <span class="entity-list__name">${escapeHtml(p.name)}</span>
                    ${p.memo ? `<span class="entity-list__memo">${escapeHtml(p.memo)}</span>` : ''}
                  </span>
                </a></li>`
              )
              .join('')}</ul>`
          : `<p class="empty-state">まだ人物が登録されていません。「＋ 新しい人物を追加」から始められます。</p>`
      }
    </div>
  `;

  root.querySelector('#add-person-btn').addEventListener('click', async () => {
    const name = await showTextInputModal({
      title: '人物を追加',
      description: '会話した相手の名前を入力してください',
      placeholder: '例：山田さん',
      confirmLabel: '追加',
    });
    if (!name) return;
    try {
      await addPerson({ name });
      renderPersonList(root);
    } catch (e) {
      alert(e.message);
    }
  });
}
