import { listAllRecords } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { listGroups } from '../db/groups.js';
import { getSetting } from '../db/settings.js';
import { recordCardHTML } from './shared.js';
import { formatDateTime } from '../lib/util.js';

export async function renderHome(root) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;

  const [records, people, groups, lastBackupAt] = await Promise.all([
    listAllRecords(),
    listPeople(),
    listGroups(),
    getSetting('lastBackupAt'),
  ]);

  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
  const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const recent = records.slice(0, 8);

  root.innerHTML = `
    <div class="view view--home">
      <header class="view-header view-header--top">
        <h1>会話記録</h1>
      </header>

      ${backupWarningHTML(lastBackupAt)}

      <nav class="quick-links">
        <a href="#/people" class="quick-link">
          <span class="quick-link__label">人物</span>
          <span class="quick-link__count">${people.length}</span>
        </a>
        <a href="#/groups" class="quick-link">
          <span class="quick-link__label">グループ</span>
          <span class="quick-link__count">${groups.length}</span>
        </a>
        <a href="#/search" class="quick-link">
          <span class="quick-link__label">検索</span>
        </a>
        <a href="#/trash" class="quick-link">
          <span class="quick-link__label">ゴミ箱</span>
        </a>
      </nav>

      <section class="section">
        <h2 class="section__title">最近の記録</h2>
        ${
          recent.length
            ? `<div class="record-list">${recent.map((r) => recordCardHTML(r, { peopleById, groupsById })).join('')}</div>`
            : `<p class="empty-state">まだ記録がありません。右下の「＋」から最初の記録を作成しましょう。</p>`
        }
      </section>
    </div>
  `;
}

function backupWarningHTML(lastBackupAt) {
  if (!lastBackupAt) {
    return `<div class="banner banner--warning">
      <p>記録はこの端末内にのみ保存されています。まだバックアップがありません。</p>
      <a href="#/settings" class="banner__action">バックアップする</a>
    </div>`;
  }
  const days = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000);
  if (days >= 14) {
    return `<div class="banner banner--warning">
      <p>最後のバックアップ（${formatDateTime(lastBackupAt)}）から${days}日経っています。</p>
      <a href="#/settings" class="banner__action">バックアップする</a>
    </div>`;
  }
  return '';
}
