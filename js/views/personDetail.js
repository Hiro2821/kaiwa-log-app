import { getPerson, updatePerson, listPeople, deletePersonCascade } from '../db/people.js';
import { listRecordsByPerson, toggleNextTimeNote } from '../db/records.js';
import { mergePersonInto } from '../lib/mergeEntity.js';
import { escapeHtml, formatDate, enc } from '../lib/util.js';
import { backLinkHTML, recordTableHTML, bindRowLinks, emptyHTML } from './shared.js';
import { showPersonFormModal, showConfirmModal, showInfoModal } from './modal.js';
import { showPersonPicker } from './personPicker.js';

export async function renderPersonDetail(root, id) {
  const person = await getPerson(id);
  if (!person) {
    root.innerHTML = `
      <div class="page">
        <header class="page-header page-header--nav">${backLinkHTML('#/people', '人物')}</header>
        ${emptyHTML('人物が見つかりませんでした。削除された可能性があります。')}
      </div>`;
    return;
  }

  // 削除されていない記録（新しい順）。ゴミ箱内の記録は一覧にも件数にも含めない。
  const records = await listRecordsByPerson(id);
  const last = records.length ? records[0].createdAt : null; // 新しい順なので先頭が最新
  const from = `person:${id}`;

  // 以前のバージョンで入力された「次回確認したいこと」。入力欄は廃止したが、
  // 既存データは失われないよう、未完了のものだけここに表示する。
  const pendingNotes = records.flatMap((r) =>
    (r.nextTimeNotes || []).filter((n) => !n.done).map((n) => ({ ...n, recordId: r.id }))
  );

  root.innerHTML = `
    <div class="page">
      <header class="page-header page-header--nav">
        ${backLinkHTML('#/people', '人物')}
        <button type="button" class="header-button" id="edit-person-btn">編集</button>
      </header>

      <h1 class="detail-title">${escapeHtml(person.name)}</h1>
      ${person.memo ? `<p class="detail-memo">${escapeHtml(person.memo)}</p>` : ''}

      <dl class="facts">
        <div class="facts__item"><dt>会話記録</dt><dd>${records.length}件</dd></div>
        <div class="facts__item"><dt>最終記録日</dt><dd>${last ? escapeHtml(formatDate(last)) : '—'}</dd></div>
      </dl>

      <div class="actions">
        <a href="#/record/new?personId=${enc(id)}&from=${encodeURIComponent(from)}" class="btn btn--primary btn--block">この人物の記録を追加</a>
      </div>

      ${
        pendingNotes.length
          ? `<section class="section">
              <h2 class="section__title">次回確認したいこと</h2>
              <ul class="note-list">
                ${pendingNotes
                  .map(
                    (n) => `<li><button type="button" class="note-toggle" data-record="${escapeHtml(n.recordId)}" data-note="${escapeHtml(n.id)}">
                      <span class="note-toggle__box" aria-hidden="true"></span>
                      <span class="note-toggle__text">${escapeHtml(n.text)}</span>
                    </button></li>`
                  )
                  .join('')}
              </ul>
            </section>`
          : ''
      }

      <section class="section">
        <h2 class="section__title">会話履歴</h2>
        ${records.length ? recordTableHTML(records, { from }) : emptyHTML('この人物との会話記録はまだありません。')}
      </section>

      <section class="section section--danger-zone">
        <div class="actions">
          <button type="button" class="btn btn--secondary btn--block" id="merge-person-btn">他の人物と統合</button>
          <button type="button" class="btn btn--danger-text btn--block" id="delete-person-btn">この人物を削除</button>
        </div>
      </section>
    </div>
  `;

  bindRowLinks(root);

  root.querySelectorAll('.note-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await toggleNextTimeNote(btn.dataset.record, btn.dataset.note);
      renderPersonDetail(root, id);
    });
  });

  root.querySelector('#edit-person-btn').addEventListener('click', async () => {
    const result = await showPersonFormModal({
      title: '人物を編集',
      name: person.name,
      memo: person.memo || '',
    });
    if (!result) return;
    try {
      await updatePerson(person.id, { name: result.name, memo: result.memo });
      renderPersonDetail(root, id);
    } catch (e) {
      await showInfoModal({ title: 'エラー', message: e.message });
    }
  });

  root.querySelector('#delete-person-btn').addEventListener('click', async () => {
    // 件数にはゴミ箱内の記録も含める（紐付けが外れる対象のため）
    const linked = await listRecordsByPerson(id, { includeDeleted: true });
    const ok = await showConfirmModal({
      title: `「${person.name}」を削除しますか？`,
      message:
        (linked.length
          ? `この人物に紐づく会話記録（${linked.length}件）は削除されません。記録からこの人物の紐付けだけが外れます。`
          : 'この人物に紐づく会話記録はありません。') + 'この操作は元に戻せません。',
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePersonCascade(id);
      location.hash = '#/people';
    } catch (e) {
      await showInfoModal({ title: '削除に失敗しました', message: e.message });
    }
  });

  root.querySelector('#merge-person-btn').addEventListener('click', async () => {
    const all = await listPeople();
    if (all.length < 2) {
      await showInfoModal({ title: '統合できません', message: '統合できる他の人物がいません。' });
      return;
    }
    const picked = await showPersonPicker({
      people: all,
      multiple: false,
      allowCreate: false,
      excludeIds: [id],
      title: `「${person.name}」の統合先`,
    });
    if (!picked) return;
    const target = picked.people.find((p) => p.id === picked.ids[0]);
    const ok = await showConfirmModal({
      title: '人物を統合しますか？',
      message: `「${person.name}」の会話記録はすべて「${target.name}」に移り、「${person.name}」は削除されます。この操作は元に戻せません。`,
      confirmLabel: '統合する',
      danger: true,
    });
    if (!ok) return;
    try {
      await mergePersonInto(id, target.id);
      location.hash = `#/people/${enc(target.id)}`;
    } catch (e) {
      await showInfoModal({ title: '統合に失敗しました', message: e.message });
    }
  });
}
