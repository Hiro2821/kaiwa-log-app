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
      <header class="home-header">
        <div class="home-brand">
          <h1 class="page-title">会話記録</h1>
          <span class="pill">KAIWA LOG</span>
        </div>
        <nav class="icon-buttons" aria-label="ショートカット">
          <a href="#/search" class="icon-button">
            <span class="icon-button__circle">
              <svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
              </svg>
            </span>
            <span class="icon-button__label">検索</span>
          </a>
          <a href="#/settings" class="icon-button">
            <span class="icon-button__circle">
              <svg class="icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M3.5 4.5h17v4h-17zM5 8.5V19h14V8.5M10 12.5h4" />
              </svg>
            </span>
            <span class="icon-button__label">データ</span>
          </a>
        </nav>
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

      <div class="nav-cards">
        <a href="#/record/new" class="nav-card">
          <span class="nav-card__chev" aria-hidden="true">›</span>
          <span class="nav-card__title">新規記録</span>
          <span class="nav-card__desc">話した内容を残す</span>
        </a>
        <a href="#/people" class="nav-card">
          <span class="nav-card__chev" aria-hidden="true">›</span>
          <span class="nav-card__title">人物一覧</span>
          <span class="nav-card__desc">表で見比べる</span>
        </a>
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
