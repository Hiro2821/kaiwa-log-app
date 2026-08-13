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

const root = document.getElementById('app');

// シンプルなハッシュルーター。SPAフレームワークは使わず、
// パターンマッチしたら対応するrender関数をroot要素に描画するだけの薄い仕組み。
const routes = [
  { pattern: /^#\/$/, render: (r) => renderHome(r) },
  { pattern: /^#\/record\/new$/, render: (r, m, q) => renderRecordForm(r, {}, q) },
  { pattern: /^#\/record\/([^/]+)\/edit$/, render: (r, m, q) => renderRecordForm(r, { id: m[1] }, q) },
  { pattern: /^#\/record\/([^/]+)$/, render: (r, m) => renderRecordDetail(r, m[1]) },
  { pattern: /^#\/people$/, render: (r) => renderPersonList(r) },
  { pattern: /^#\/people\/([^/]+)$/, render: (r, m) => renderPersonDetail(r, m[1]) },
  { pattern: /^#\/groups$/, render: (r) => renderGroupList(r) },
  { pattern: /^#\/groups\/([^/]+)$/, render: (r, m) => renderGroupDetail(r, m[1]) },
  { pattern: /^#\/search$/, render: (r, m, q) => renderSearch(r, m, q) },
  { pattern: /^#\/settings$/, render: (r) => renderSettings(r) },
  { pattern: /^#\/trash$/, render: (r) => renderTrash(r) },
];

function parseHash() {
  const raw = location.hash || '#/';
  const [path, qs] = raw.split('?');
  return { path, query: new URLSearchParams(qs || '') };
}

async function route() {
  const { path, query } = parseHash();
  const matched = routes.find((r) => r.pattern.test(path));
  root.innerHTML = '';
  try {
    if (matched) {
      const m = path.match(matched.pattern);
      await matched.render(root, m, query);
    } else {
      await renderHome(root);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="view"><p class="empty-state">エラーが発生しました: ${escapeForError(err.message)}</p><a href="#/" class="secondary-button full-width">ホームへ</a></div>`;
  }
  updateNav(path);
  updateFab(path);
  window.scrollTo(0, 0);
}

// 人物詳細・グループ詳細画面を見ているときは、フローティングの「＋」ボタンから
// その人物・グループを選択済みの状態で記録作成画面に飛べるようにする。
// 「記録追加」ボタン自体は画面下部にあるが、FABは常に画面右下に表示され続けるため、
// スクロール位置に関わらずワンタップで記録を追加できる。
function updateFab(path) {
  const fab = document.querySelector('.fab');
  if (!fab) return;
  const personMatch = path.match(/^#\/people\/([^/]+)$/);
  const groupMatch = path.match(/^#\/groups\/([^/]+)$/);
  if (personMatch) {
    fab.setAttribute('href', `#/record/new?personId=${personMatch[1]}`);
  } else if (groupMatch) {
    fab.setAttribute('href', `#/record/new?groupId=${groupMatch[1]}`);
  } else {
    fab.setAttribute('href', '#/record/new');
  }
}

function escapeForError(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function updateNav(path) {
  document.querySelectorAll('.bottom-nav a').forEach((a) => {
    const match = a.dataset.match;
    const isActive = match === '#/' ? path === '#/' : path.startsWith(match);
    a.classList.toggle('is-active', isActive);
  });
}

window.addEventListener('hashchange', route);

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
  } catch (err) {
    root.innerHTML = `<div class="view"><p class="empty-state">データベースの初期化に失敗しました: ${escapeForError(err.message)}</p></div>`;
    console.error(err);
    return;
  }
  route();
});
