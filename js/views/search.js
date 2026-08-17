import { listAllRecords } from '../db/records.js';
import { searchRecords } from '../lib/search.js';
import { recordCardHTML } from './shared.js';
import { escapeHtml } from '../lib/util.js';

export async function renderSearch(root, m, query) {
  const initialQuery = query?.get?.('q') || '';

  root.innerHTML = `
    <div class="view view--search">
      <header class="view-header">
        <a href="#/" class="back-link" aria-label="戻る">←</a>
        <h1>検索</h1>
      </header>
      <input id="search-input" class="text-input search-input" type="search" inputmode="search"
             placeholder="人物・話題・内容などで検索" value="${escapeHtml(initialQuery)}">
      <div id="search-results"></div>
    </div>
  `;

  const input = root.querySelector('#search-input');
  const resultsEl = root.querySelector('#search-results');
  let allRecordsCache = null;
  let debounceTimer = null;

  async function runSearch() {
    if (allRecordsCache === null) {
      allRecordsCache = await listAllRecords();
    }
    const q = input.value.trim();
    if (!q) {
      resultsEl.innerHTML = `<p class="empty-hint">キーワードを入力してください。</p>`;
      return;
    }
    const results = searchRecords(allRecordsCache, q);
    resultsEl.innerHTML = results.length
      ? `<div class="record-list">${results.map((r) => recordCardHTML(r)).join('')}</div>`
      : `<p class="empty-state">見つかりませんでした。</p>`;
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 150);
  });

  input.focus();
  if (initialQuery) runSearch();
  else resultsEl.innerHTML = `<p class="empty-hint">キーワードを入力してください。</p>`;
}
