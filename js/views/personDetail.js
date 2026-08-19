import { getPerson, updatePerson, listPeople } from '../db/people.js';
import { toggleNextTimeNote, listRecordsByPerson } from '../db/records.js';
import { getPersonSummary } from '../lib/personSummary.js';
import { mergePersonInto } from '../lib/mergeEntity.js';
import { recordCardHTML } from './shared.js';
import { escapeHtml } from '../lib/util.js';

export async function renderPersonDetail(root, id) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;

  const person = await getPerson(id);
  if (!person) {
    root.innerHTML = `
      <div class="view">
        <p class="empty-state">人物が見つかりませんでした。</p>
        <a href="#/people" class="secondary-button full-width">人物一覧へ</a>
      </div>`;
    return;
  }

  // getPersonSummary()（js/lib/、変更不可）は最近の会話を5件までに絞って返す。
  // 「④ すべての記録」をUIに追加するため、既存の listRecordsByPerson() を
  // ここでもう一度呼び出して全件を取得する（データ層のロジック自体は変更していない）。
  const [summary, allRecords] = await Promise.all([getPersonSummary(id), listRecordsByPerson(id)]);
  const pendingNotes = summary.nextTimeNotes.filter((n) => !n.done);
  const doneNotes = summary.nextTimeNotes.filter((n) => n.done);

  root.innerHTML = `
    <div class="view view--person-detail">
      <header class="view-header">
        <a href="#/people" class="back-link" aria-label="戻る">←</a>
      </header>

      <div class="person-name-header">
        <h1>${escapeHtml(person.name)}</h1>
      </div>

      ${nextTimeNotesSectionHTML(pendingNotes, doneNotes)}

      <section class="section">
        <h2 class="section__title">最近の会話（全${summary.totalCount}件）</h2>
        ${
          summary.recent.length
            ? `<div class="record-list">${summary.recent.map((r) => recordCardHTML(r, { showTags: false })).join('')}</div>`
            : `<p class="empty-state">まだ記録がありません。</p>`
        }
      </section>

      ${
        summary.topics.length
          ? `<section class="highlight-block">
              <h2>過去の話題</h2>
              <div class="pill-row">
                ${summary.topics.map((t) => `<span class="pill">${escapeHtml(t.topic)}（${t.count}）</span>`).join('')}
              </div>
            </section>`
          : ''
      }

      ${
        allRecords.length > summary.recent.length
          ? `<details class="details-toggle">
              <summary>すべての記録を見る（全${allRecords.length}件）</summary>
              <div class="details-toggle__content record-list">
                ${allRecords.map((r) => recordCardHTML(r, { showTags: false })).join('')}
              </div>
            </details>`
          : ''
      }

      <div class="form-actions">
        <a href="#/record/new?personId=${person.id}" class="primary-button full-width">
          ＋ ${escapeHtml(person.name)}さんとの記録を追加
        </a>
        <button id="edit-person-btn" class="secondary-button">名前・メモを編集</button>
        <button id="merge-person-btn" class="secondary-button">他の人物と統合</button>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-toggle-record]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await toggleNextTimeNote(btn.dataset.toggleRecord, btn.dataset.toggleNote);
      renderPersonDetail(root, id);
    });
  });

  root.querySelector('#edit-person-btn').addEventListener('click', async () => {
    const newName = prompt('名前を編集', person.name);
    if (newName === null) return;
    if (!newName.trim()) {
      alert('名前は空にできません。');
      return;
    }
    const newMemo = prompt('メモを編集（任意）', person.memo || '');
    await updatePerson(person.id, { name: newName.trim(), memo: (newMemo || '').trim() });
    renderPersonDetail(root, id);
  });

  root.querySelector('#merge-person-btn').addEventListener('click', async () => {
    const others = (await listPeople()).filter((p) => p.id !== person.id);
    if (!others.length) {
      alert('統合できる他の人物がありません。');
      return;
    }
    const listText = others.map((p, i) => `${i + 1}: ${p.name}`).join('\n');
    const answer = prompt(
      `「${person.name}」を統合する相手を番号で選んでください。\n` +
        `「${person.name}」の記録はすべて統合先に移り、「${person.name}」自体は削除されます。\n\n${listText}`
    );
    if (answer === null) return;
    const idx = Number(answer) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= others.length) {
      alert('番号が正しくありません。');
      return;
    }
    const target = others[idx];
    if (!confirm(`「${person.name}」を「${target.name}」に統合します。この操作は元に戻せません。よろしいですか？`)) return;
    await mergePersonInto(person.id, target.id);
    location.hash = `#/people/${target.id}`;
  });
}

// 「次回確認したいこと」セクション。未完了を優先表示し、完了済みは
// <details> で折りたたんでおく（アプリの目的上、最も重要な情報のため最上部に置く）。
export function nextTimeNotesSectionHTML(pendingNotes, doneNotes) {
  if (!pendingNotes.length && !doneNotes.length) return '';
  return `
    <section class="highlight-block highlight-block--flag">
      <h2>次回確認したいこと</h2>
      ${
        pendingNotes.length
          ? `<ul class="tag-list">${pendingNotes.map((n) => nextNoteRowHTML(n)).join('')}</ul>`
          : `<p class="empty-hint">未完了の項目はありません。</p>`
      }
      ${
        doneNotes.length
          ? `<details class="done-notes">
              <summary>完了済みを見る（${doneNotes.length}件）</summary>
              <ul class="tag-list">${doneNotes.map((n) => nextNoteRowHTML(n)).join('')}</ul>
            </details>`
          : ''
      }
    </section>`;
}

function nextNoteRowHTML(n) {
  return `<li>
    <button type="button" class="next-note-toggle" data-toggle-record="${n.recordId}" data-toggle-note="${n.id}">
      <span class="next-note-toggle__box" aria-hidden="true">${n.done ? '✓' : '□'}</span>
      <span class="next-note-toggle__text ${n.done ? 'is-done' : ''}">${escapeHtml(n.text)}</span>
    </button>
  </li>`;
}
