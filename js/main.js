import { initDB } from './db/database.js';
import { renderHome } from './views/home.js';
import { renderRecordForm } from './views/recordForm.js';
import { renderRecordDetail } from './views/recordDetail.js';
import { renderPersonList } from './views/personList.js';
import { renderPersonDetail } from './views/personDetail.js';
import { renderGroupList } from './views/groupList.js';
import { renderGroupDetail } from './views/groupDetail.js';
import { renderSearch } from './views/search.js';
import { renderSettings } from './views/settings.js';
import { renderTrash } from './views/trash.js';
import { tabForFrom } from './lib/nav.js';
import { dec, escapeHtml } from './lib/util.js';

const root = document.getElementById('app');

// シンプルなハッシュルーター。SPAフレームワークは使わず、
// パターンにマッチした画面の render 関数に描画させるだけの薄い仕組み。
// tab は下部ナビゲーションのどれを選択状態にするか。
const routes = [
  { pattern: /^#\/$/, tab: 'home', render: (c) => renderHome(c) },
  { pattern: /^#\/people$/, tab: 'people', render: (c) => renderPersonList(c) },
  { pattern: /^#\/people\/([^/]+)$/, tab: 'people', render: (c, m) => renderPersonDetail(c, dec(m[1])) },
  { pattern: /^#\/record\/new$/, tab: 'new', render: (c, m, q) => renderRecordForm(c, {}, q) },
  {
    pattern: /^#\/record\/([^/]+)\/edit$/,
    tab: (m, q) => tabForFrom(q.get('from')),
    render: (c, m, q) => renderRecordForm(c, { id: dec(m[1]) }, q),
  },
  {
    pattern: /^#\/record\/([^/]+)$/,
    tab: (m, q) => tabForFrom(q.get('from')),
    render: (c, m, q) => renderRecordDetail(c, dec(m[1]), q),
  },
  { pattern: /^#\/groups$/, tab: 'home', render: (c) => renderGroupList(c) },
  { pattern: /^#\/groups\/([^/]+)$/, tab: 'home', render: (c, m) => renderGroupDetail(c, dec(m[1])) },
  { pattern: /^#\/search$/, tab: 'home', render: (c, m, q) => renderSearch(c, m, q) },
  { pattern: /^#\/settings$/, tab: 'home', render: (c) => renderSettings(c) },
  { pattern: /^#\/trash$/, tab: 'home', render: (c) => renderTrash(c) },
];

function parseHash() {
  const raw = location.hash || '#/';
  const i = raw.indexOf('?');
  const path = i === -1 ? raw : raw.slice(0, i);
  const qs = i === -1 ? '' : raw.slice(i + 1);
  return { path: path || '#/', query: new URLSearchParams(qs) };
}

// 連続して素早く画面を切り替えたとき、古い画面の描画が後から上書きしないよう
// 世代番号で管理する。画面は別のコンテナに描画し、完成してから差し替える。
let routeSeq = 0;

async function route() {
  const seq = ++routeSeq;
  const { path, query } = parseHash();
  const matched = routes.find((r) => r.pattern.test(path));
  const m = matched ? path.match(matched.pattern) : null;

  const container = document.createElement('div');
  try {
    if (matched) {
      await matched.render(container, m, query);
    } else {
      await renderHome(container);
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="page">
        <p class="empty">エラーが発生しました: ${escapeHtml(err.message)}</p>
        <div class="actions"><a href="#/" class="btn btn--secondary btn--block">ホームへ</a></div>
      </div>`;
  }
  if (seq !== routeSeq) return; // その間に別の画面へ移動していた

  root.replaceChildren(container);
  const tab = matched ? (typeof matched.tab === 'function' ? matched.tab(m, query) : matched.tab) : 'home';
  updateNav(tab);
  window.scrollTo(0, 0);
}

function updateNav(tab) {
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const active = a.dataset.tab === tab;
    a.classList.toggle('is-active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

window.addEventListener('hashchange', route);

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
  } catch (err) {
    root.innerHTML = `<div class="page"><p class="empty">データベースの初期化に失敗しました: ${escapeHtml(err.message)}</p></div>`;
    console.error(err);
    return;
  }
  route();
});
