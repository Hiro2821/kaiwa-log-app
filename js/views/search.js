import { listAllRecords } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { searchRecords } from '../lib/search.js';
import { escapeHtml, normalizeForSearch } from '../lib/util.js';
import { backLinkHTML, recordTableHTML, bindRowLinks, emptyHTML, personNames } from './shared.js';

const PAGE_SIZE = 100;

// 記録の検索。検索語が空のときは、すべての記録を新しい順に表示する。
// 検索対象は、タイトル・本文・人物名（と、以前の入力項目である話題など）。
export async function renderSearch(root, m, query) {
  const initialQuery = query?.get?.('q') || '';
  const [records, people] = await Promise.all([listAllRecords(), listPeople()]);
  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));

  root.innerHTML = `
    <div class="page">
      <header class="page-header page-header--nav">${backLinkHTML('#/', 'ホーム')}</header>
      <header class="page-header"><h1 class="page-title">記録を検索</h1></header>
      <input id="search-input" class="field field--search" type="search" inputmode="search"
             placeholder="タイトル・本文・人物名で検索" autocomplete="off" autocapitalize="off"
             value="${escapeHtml(initialQuery)}" aria-label="記録を検索">
      <div id="search-results"></div>
    </div>
  `;

  const input = root.querySelector('#search-input');
  const resultsEl = root.querySelector('#search-results');
  let limit = PAGE_SIZE;
  let timer = null;

  function matches(q) {
    if (!q) return records;
    const nq = normalizeForSearch(q);
    const textHits = new Set(searchRecords(records, q).map((r) => r.id));
    return records.filter(
      (r) => textHits.has(r.id) || personNames(r, peopleById).some((n) => normalizeForSearch(n).includes(nq))
    );
  }

  function draw() {
    const q = input.value.trim();
    const hits = matches(q);
    const shown = hits.slice(0, limit);
    // 詳細から戻ったときに検索語が復元されるよう、遷移元に検索語を持たせる
    const from = `search:${q}`;

    if (!records.length) {
      resultsEl.innerHTML = emptyHTML('まだ会話記録がありません。');
      return;
    }
    if (!hits.length) {
      resultsEl.innerHTML = emptyHTML('該当する記録が見つかりませんでした。');
      return;
    }
    resultsEl.innerHTML = `
      <p class="caption">${q ? `${hits.length}件ヒット` : `すべての記録（${hits.length}件）`}</p>
      ${recordTableHTML(shown, { peopleById, showPeople: true, from })}
      ${
        hits.length > shown.length
          ? `<div class="actions"><button type="button" class="btn btn--secondary btn--block" id="more-btn">さらに表示（残り${hits.length - shown.length}件）</button></div>`
          : ''
      }`;
    resultsEl.querySelector('#more-btn')?.addEventListener('click', () => {
      limit += PAGE_SIZE;
      draw();
    });
  }

  bindRowLinks(resultsEl);

  input.addEventListener('input', () => {
    limit = PAGE_SIZE;
    clearTimeout(timer);
    timer = setTimeout(() => {
      draw();
      // hashchange を起こさずにURLへ検索語を反映する（戻ったときの復元用）
      const q = input.value.trim();
      history.replaceState(null, '', q ? `#/search?q=${encodeURIComponent(q)}` : '#/search');
    }, 150);
  });

  draw();
}
