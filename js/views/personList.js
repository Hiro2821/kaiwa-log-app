import { listPeople, addPerson } from '../db/people.js';
import { listAllRecords } from '../db/records.js';
import { escapeHtml, formatDate, normalizeForSearch, enc } from '../lib/util.js';
import { showPersonFormModal, showInfoModal } from './modal.js';
import { bindRowLinks, statsByPerson, emptyHTML } from './shared.js';

// 人物一覧（表形式）。列: 人物名 / 記録数 / 最終記録日 / メモ
// 見出しをタップすると並べ替え（名前・記録数・最終記録日）。検索は名前とメモが対象。
const COLUMNS = [
  { key: 'name', label: '人物名', cls: 'col-name', sortable: true, firstDir: 'asc' },
  { key: 'count', label: '記録数', cls: 'col-count', sortable: true, firstDir: 'desc' },
  { key: 'last', label: '最終記録日', cls: 'col-last', sortable: true, firstDir: 'desc' },
  { key: 'memo', label: 'メモ', cls: 'col-memo', sortable: false },
];

export async function renderPersonList(root) {
  const [people, records] = await Promise.all([listPeople(), listAllRecords()]);
  const stats = statsByPerson(records);

  const rowsData = people.map((p) => ({
    person: p,
    count: stats.get(p.id)?.count ?? 0,
    last: stats.get(p.id)?.last ?? null,
  }));

  const state = { query: '', sortKey: 'name', dir: 'asc' };

  root.innerHTML = `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">人物</h1>
        <button type="button" class="header-button" id="add-person-btn">＋ 追加</button>
      </header>
      <input id="person-search" class="field field--search" type="search" inputmode="search"
             placeholder="名前・メモで検索" autocomplete="off" autocapitalize="off" aria-label="人物を検索">
      <div id="person-table"></div>
      <p class="caption" id="person-caption"></p>
    </div>
  `;

  const tableEl = root.querySelector('#person-table');
  const captionEl = root.querySelector('#person-caption');

  function compare(a, b) {
    const dir = state.dir === 'asc' ? 1 : -1;
    if (state.sortKey === 'name') return dir * a.person.name.localeCompare(b.person.name, 'ja');
    if (state.sortKey === 'count') {
      return dir * (a.count - b.count) || a.person.name.localeCompare(b.person.name, 'ja');
    }
    // 最終記録日: 記録がない人物は、昇順・降順どちらでも末尾に置く
    if (!a.last && !b.last) return a.person.name.localeCompare(b.person.name, 'ja');
    if (!a.last) return 1;
    if (!b.last) return -1;
    return dir * a.last.localeCompare(b.last) || a.person.name.localeCompare(b.person.name, 'ja');
  }

  function draw() {
    const nq = normalizeForSearch(state.query.trim());
    const rows = rowsData
      .filter(
        (r) => !nq || normalizeForSearch(r.person.name).includes(nq) || normalizeForSearch(r.person.memo).includes(nq)
      )
      .sort(compare);

    if (!rowsData.length) {
      tableEl.innerHTML = emptyHTML('まだ人物が登録されていません。右上の「＋ 追加」から登録できます。');
      captionEl.textContent = '';
      return;
    }
    if (!rows.length) {
      tableEl.innerHTML = emptyHTML('該当する人物がいません。');
      captionEl.textContent = `全${rowsData.length}人`;
      return;
    }

    const head = COLUMNS.map((c) => {
      if (!c.sortable) return `<th scope="col" class="${c.cls}">${c.label}</th>`;
      const active = state.sortKey === c.key;
      const ariaSort = active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none';
      const arrow = active ? (state.dir === 'asc' ? '▲' : '▼') : '';
      return `<th scope="col" class="${c.cls}" aria-sort="${ariaSort}">
        <button type="button" class="th-sort" data-sort="${c.key}">${c.label}<span class="th-sort__arrow" aria-hidden="true">${arrow}</span></button>
      </th>`;
    }).join('');

    const body = rows
      .map(({ person: p, count, last }) => {
        const href = `#/people/${enc(p.id)}`;
        return `<tr data-href="${href}">
          <td class="col-name"><a href="${href}"><span class="clamp">${escapeHtml(p.name)}</span></a></td>
          <td class="col-count">${count}</td>
          <td class="col-last">${last ? escapeHtml(formatDate(last)) : '—'}</td>
          <td class="col-memo"><span class="clamp">${p.memo ? escapeHtml(p.memo) : ''}</span></td>
        </tr>`;
      })
      .join('');

    tableEl.innerHTML = `<div class="table-wrap">
      <table class="table table--people">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
    captionEl.textContent = nq ? `${rows.length}人 / 全${rowsData.length}人` : `全${rowsData.length}人`;
  }

  bindRowLinks(tableEl);

  tableEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    const key = btn.dataset.sort;
    if (state.sortKey === key) {
      state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.dir = COLUMNS.find((c) => c.key === key).firstDir;
    }
    draw();
  });

  root.querySelector('#person-search').addEventListener('input', (e) => {
    state.query = e.target.value;
    draw();
  });

  root.querySelector('#add-person-btn').addEventListener('click', async () => {
    const result = await showPersonFormModal({ title: '人物を追加', confirmLabel: '追加' });
    if (!result) return;
    try {
      const p = await addPerson(result);
      rowsData.push({ person: p, count: 0, last: null });
      draw();
    } catch (e) {
      await showInfoModal({ title: 'エラー', message: e.message });
    }
  });

  draw();
}
