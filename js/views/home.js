import { listAllRecords } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { getSetting } from '../db/settings.js';
import { recordTableHTML, bindRowLinks, emptyHTML } from './shared.js';
import { formatDateTime } from '../lib/util.js';

const RECENT_COUNT = 10;

export async function renderHome(root) {
  const [records, people, lastBackupAt] = await Promise.all([
    listAllRecords(), // ゴミ箱の記録は含まない・新しい順
    listPeople(),
    getSetting('lastBackupAt'),
  ]);

  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
  const recent = records.slice(0, RECENT_COUNT);

  root.innerHTML = `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">ホーム</h1>
        <a href="#/settings" class="header-link">データ管理</a>
      </header>

      ${backupNoticeHTML(lastBackupAt, records.length + people.length > 0)}

      <dl class="stats">
        <a href="#/people" class="stats__item">
          <dt>登録人物</dt>
          <dd><span class="stats__num">${people.length}</span><span class="stats__unit">人</span></dd>
        </a>
        <div class="stats__item">
          <dt>会話記録</dt>
          <dd><span class="stats__num">${records.length}</span><span class="stats__unit">件</span></dd>
        </div>
      </dl>

      <div class="actions actions--row">
        <a href="#/record/new" class="btn btn--primary">新規記録</a>
        <a href="#/people" class="btn btn--secondary">人物一覧</a>
      </div>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">最近の会話記録</h2>
          <a href="#/search" class="section__link">すべて・検索</a>
        </div>
        ${
          recent.length
            ? recordTableHTML(recent, { peopleById, showPeople: true, from: 'home' })
            : emptyHTML('まだ会話記録がありません。「新規記録」から追加できます。')
        }
      </section>
    </div>
  `;

  bindRowLinks(root);
}

// 記録がこの端末内にしかないことを伝え、バックアップを促す（目立たせすぎない）。
function backupNoticeHTML(lastBackupAt, hasData) {
  if (!hasData) return '';
  if (!lastBackupAt) {
    return `<div class="notice">
      <p>データはこの端末内にのみ保存されています。まだバックアップがありません。</p>
      <a href="#/settings" class="notice__action">バックアップする</a>
    </div>`;
  }
  const days = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000);
  if (days >= 14) {
    return `<div class="notice">
      <p>最後のバックアップ（${formatDateTime(lastBackupAt)}）から${days}日経っています。</p>
      <a href="#/settings" class="notice__action">バックアップする</a>
    </div>`;
  }
  return '';
}
