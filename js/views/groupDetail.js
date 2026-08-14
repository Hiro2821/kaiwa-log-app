import { getGroup, updateGroup, listGroups } from '../db/groups.js';
import { toggleNextTimeNote } from '../db/records.js';
import { getGroupSummary } from '../lib/groupSummary.js';
import { mergeGroupInto } from '../lib/mergeEntity.js';
import { recordCardHTML } from './shared.js';
import { nextTimeNotesSectionHTML } from './personDetail.js';
import { escapeHtml } from '../lib/util.js';

export async function renderGroupDetail(root, id) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;

  const group = await getGroup(id);
  if (!group) {
    root.innerHTML = `
      <div class="view">
        <p class="empty-state">グループが見つかりませんでした。</p>
        <a href="#/groups" class="secondary-button full-width">グループ一覧へ</a>
      </div>`;
    return;
  }

  const summary = await getGroupSummary(id);
  const pendingNotes = summary.nextTimeNotes.filter((n) => !n.done);
  const doneNotes = summary.nextTimeNotes.filter((n) => n.done);

  root.innerHTML = `
    <div class="view view--person-detail">
      <header class="view-header">
        <a href="#/groups" class="back-link" aria-label="戻る">←</a>
        <h1>${escapeHtml(group.name)}</h1>
      </header>

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

      <div class="form-actions">
        <a href="#/record/new?groupId=${group.id}" class="primary-button full-width">
          ＋ ${escapeHtml(group.name)}の記録を追加
        </a>
        <button id="edit-group-btn" class="secondary-button">名前・メモを編集</button>
        <button id="merge-group-btn" class="secondary-button">他のグループと統合</button>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-toggle-record]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await toggleNextTimeNote(btn.dataset.toggleRecord, btn.dataset.toggleNote);
      renderGroupDetail(root, id);
    });
  });

  root.querySelector('#edit-group-btn').addEventListener('click', async () => {
    const newName = prompt('名前を編集', group.name);
    if (newName === null) return;
    if (!newName.trim()) {
      alert('名前は空にできません。');
      return;
    }
    const newMemo = prompt('メモを編集（任意）', group.memo || '');
    await updateGroup(group.id, { name: newName.trim(), memo: (newMemo || '').trim() });
    renderGroupDetail(root, id);
  });

  root.querySelector('#merge-group-btn').addEventListener('click', async () => {
    const others = (await listGroups()).filter((g) => g.id !== group.id);
    if (!others.length) {
      alert('統合できる他のグループがありません。');
      return;
    }
    const listText = others.map((g, i) => `${i + 1}: ${g.name}`).join('\n');
    const answer = prompt(
      `「${group.name}」を統合する相手を番号で選んでください。\n` +
        `「${group.name}」の記録はすべて統合先に移り、「${group.name}」自体は削除されます。\n\n${listText}`
    );
    if (answer === null) return;
    const idx = Number(answer) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= others.length) {
      alert('番号が正しくありません。');
      return;
    }
    const target = others[idx];
    if (!confirm(`「${group.name}」を「${target.name}」に統合します。この操作は元に戻せません。よろしいですか？`)) return;
    await mergeGroupInto(group.id, target.id);
    location.hash = `#/groups/${target.id}`;
  });
}
