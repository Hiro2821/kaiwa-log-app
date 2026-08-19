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
      <header class="hero">
        <h1 class="hero__title">会話記録</h1>
        <p class="hero__tagline">話したことを、次の会話へ。</p>
      </header>

      ${backupWarningHTML(lastBackupAt)}

      <a href="#/record/new" class="hero-cta">＋ 新しい記録</a>

      <nav class="access-cards">
        <a href="#/people" class="access-card">
          <span class="access-card__count">${people.length}</span>
          <span class="access-card__label">人物</span>
        </a>
        <a href="#/groups" class="access-card">
          <span class="access-card__count">${groups.length}</span>
          <span class="access-card__label">グループ</span>
        </a>
        <a href="#/search" class="access-card">
          <span class="access-card__label">検索</span>
        </a>
      </nav>

      <section class="section">
        <h2 class="section__title">最近の記録</h2>
        ${
          recent.length
            ? `<div class="record-list">${recent.map((r) => recordCardHTML(r, { peopleById, groupsById })).join('')}</div>`
            : `<p class="empty-state">まだ記録がありません。上の「＋ 新しい記録」から始めましょう。</p>`
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
