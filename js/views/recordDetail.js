import { getRecord, softDeleteRecord, restoreRecord, toggleNextTimeNote } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { listGroups } from '../db/groups.js';
import { escapeHtml, formatDateTime, enc } from '../lib/util.js';
import { backTarget, recordEditHref } from '../lib/nav.js';
import { backLinkHTML, emptyHTML } from './shared.js';
import { showConfirmModal, showInfoModal } from './modal.js';

// 記録詳細。本文を読みやすく表示することを最優先にする。
export async function renderRecordDetail(root, id, query) {
  const from = query?.get?.('from') || null;
  const back = backTarget(from);

  const [record, people, groups] = await Promise.all([getRecord(id), listPeople(), listGroups()]);

  if (!record) {
    root.innerHTML = `
      <div class="page">
        <header class="page-header page-header--nav">${backLinkHTML(back.href, back.label)}</header>
        ${emptyHTML('記録が見つかりませんでした。削除された可能性があります。')}
      </div>`;
    return;
  }

  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
  const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]));
  const linkedPeople = (record.personIds || []).map((pid) => peopleById[pid]).filter(Boolean);
  const linkedGroups = (record.groupIds || []).map((gid) => groupsById[gid]).filter(Boolean);
  const edited = record.updatedAt && record.createdAt && record.updatedAt !== record.createdAt;
  const trashed = !!record.deletedAt;

  root.innerHTML = `
    <div class="page page--reading">
      <header class="page-header page-header--nav">
        ${backLinkHTML(back.href, back.label)}
        <a href="${recordEditHref(record.id, from)}" class="header-button">編集</a>
      </header>

      ${
        trashed
          ? `<div class="notice">
              <p>この記録はゴミ箱に入っています。</p>
              <button type="button" class="notice__action" id="restore-btn">元に戻す</button>
            </div>`
          : ''
      }

      <h1 class="detail-title">${escapeHtml(record.title || '（無題）')}</h1>

      <dl class="meta">
        <div class="meta__row">
          <dt>記録日時</dt>
          <dd>${escapeHtml(formatDateTime(record.createdAt))}${
            edited ? `<span class="meta__sub">（編集 ${escapeHtml(formatDateTime(record.updatedAt))}）</span>` : ''
          }</dd>
        </div>
        <div class="meta__row">
          <dt>人物</dt>
          <dd>${
            linkedPeople.length
              ? `<span class="chips">${linkedPeople
                  .map((p) => `<a class="chip" href="#/people/${enc(p.id)}">${escapeHtml(p.name)}</a>`)
                  .join('')}</span>`
              : '<span class="muted">なし</span>'
          }</dd>
        </div>
        ${
          linkedGroups.length
            ? `<div class="meta__row"><dt>グループ</dt><dd>${linkedGroups
                .map((g) => `<a class="chip" href="#/groups/${enc(g.id)}">${escapeHtml(g.name)}</a>`)
                .join('')}</dd></div>`
            : ''
        }
      </dl>

      <article class="reading" aria-label="会話内容">${
        record.text ? escapeHtml(record.text) : '<span class="muted">（本文なし）</span>'
      }</article>

      ${extraBlocks(record)}

      <section class="section section--danger-zone">
        <div class="actions actions--row">
          <a href="${recordEditHref(record.id, from)}" class="btn btn--secondary">編集</a>
          ${
            trashed
              ? ''
              : '<button type="button" class="btn btn--danger-text" id="delete-btn">削除</button>'
          }
        </div>
      </section>
    </div>
  `;

  root.querySelectorAll('[data-toggle-note]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await toggleNextTimeNote(record.id, btn.dataset.toggleNote);
      renderRecordDetail(root, id, query);
    });
  });

  root.querySelector('#restore-btn')?.addEventListener('click', async () => {
    await restoreRecord(record.id);
    renderRecordDetail(root, id, query);
  });

  root.querySelector('#delete-btn')?.addEventListener('click', async () => {
    const ok = await showConfirmModal({
      title: 'この記録を削除しますか？',
      message: '削除した記録は「データ管理」のゴミ箱から元に戻せます。',
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    try {
      await softDeleteRecord(record.id);
      location.hash = back.href;
    } catch (e) {
      await showInfoModal({ title: '削除に失敗しました', message: e.message });
    }
  });
}

// 以前のバージョンで入力された補足情報（話題・重要事項・次回確認したいこと）。
// 入力欄は廃止したが、既存データが見えなくならないよう、ある場合だけ読み取り用に表示する。
function extraBlocks(record) {
  const topics = record.topics || [];
  const keyPoints = record.keyPoints || [];
  const notes = record.nextTimeNotes || [];
  if (!topics.length && !keyPoints.length && !notes.length) return '';

  const list = (items) => `<ul class="plain-list">${items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
  return `<section class="section">
    <h2 class="section__title">補足</h2>
    ${topics.length ? `<h3 class="subhead">話題</h3>${list(topics)}` : ''}
    ${keyPoints.length ? `<h3 class="subhead">重要事項</h3>${list(keyPoints)}` : ''}
    ${
      notes.length
        ? `<h3 class="subhead">次回確認したいこと</h3>
           <ul class="note-list">${notes
             .map(
               (n) => `<li><button type="button" class="note-toggle ${n.done ? 'is-done' : ''}" data-toggle-note="${escapeHtml(n.id)}">
                 <span class="note-toggle__box" aria-hidden="true">${n.done ? '✓' : ''}</span>
                 <span class="note-toggle__text">${escapeHtml(n.text)}</span>
               </button></li>`
             )
             .join('')}</ul>`
        : ''
    }
  </section>`;
}
