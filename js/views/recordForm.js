import { addRecord, updateRecord, getRecord } from '../db/records.js';
import { listPeople, addPerson } from '../db/people.js';
import { listGroups, addGroup } from '../db/groups.js';
import { generateTitle } from '../lib/autoTitle.js';
import { escapeHtml, splitCsv, uuid } from '../lib/util.js';

export async function renderRecordForm(root, params = {}, query) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;

  const editingId = params?.id || null;
  const existing = editingId ? await getRecord(editingId) : null;

  const presetPersonId = query?.get?.('personId') || null;
  const presetGroupId = query?.get?.('groupId') || null;

  const [people, groups] = await Promise.all([listPeople(), listGroups()]);

  const selectedPersonIds = new Set(existing?.personIds || (presetPersonId ? [presetPersonId] : []));
  const selectedGroupIds = new Set(existing?.groupIds || (presetGroupId ? [presetGroupId] : []));

  // 次回確認したいことは { id, text, done, doneAt } の配列で管理する。
  // 編集時は既存項目の id / done / doneAt をそのまま保持し、
  // 新規追加した項目だけが done: false の新しいオブジェクトになる。
  // （古い形式のデータが万一残っていた場合の保険として文字列も許容する）
  let nextNotesState = (existing?.nextTimeNotes || []).map((n) =>
    typeof n === 'string' ? { id: uuid(), text: n, done: false, doneAt: null } : n
  );

  root.innerHTML = `
    <div class="view view--form">
      <header class="view-header">
        <a href="javascript:history.back()" class="back-link" aria-label="戻る">←</a>
        <h1>${existing ? '記録を編集' : '新しい記録'}</h1>
      </header>
      <form id="record-form" class="form">
        <section class="form-section">
          <label class="form-label">人物（任意・複数選択できます）</label>
          <div id="person-checks" class="chip-select">
            ${people.map((p) => chipHTML(p, selectedPersonIds.has(p.id))).join('') || emptyHint('まだ人物が登録されていません')}
          </div>
          <button type="button" id="add-person-inline" class="link-button">＋ 新しい人物を追加</button>
        </section>

        <section class="form-section">
          <label class="form-label">グループ（任意・複数選択できます）</label>
          <div id="group-checks" class="chip-select">
            ${groups.map((g) => chipHTML(g, selectedGroupIds.has(g.id))).join('') || emptyHint('まだグループが登録されていません')}
          </div>
          <button type="button" id="add-group-inline" class="link-button">＋ 新しいグループを追加</button>
        </section>

        <section class="form-section">
          <label class="form-label" for="text-input">内容</label>
          <textarea id="text-input" class="textarea" rows="7" placeholder="ここをタップし、キーボードのマイクボタンで音声入力もできます">${escapeHtml(existing?.text || '')}</textarea>
        </section>

        <section class="form-section">
          <label class="form-label" for="title-input">タイトル</label>
          <div class="input-with-button">
            <input id="title-input" type="text" value="${escapeHtml(existing?.title || '')}" placeholder="空欄なら保存時に自動生成されます">
            <button type="button" id="gen-title-btn" class="secondary-button">自動生成</button>
          </div>
        </section>

        <section class="form-section">
          <label class="form-label" for="topics-input">話題（カンマ区切り）</label>
          <input id="topics-input" type="text" value="${escapeHtml((existing?.topics || []).join(', '))}" placeholder="例：旅行, 映画">
        </section>

        <section class="form-section">
          <label class="form-label" for="keypoints-input">重要事項（カンマ区切り）</label>
          <input id="keypoints-input" type="text" value="${escapeHtml((existing?.keyPoints || []).join(', '))}">
        </section>

        <section class="form-section">
          <label class="form-label">次回確認したいこと</label>
          <ul id="next-notes-list" class="next-notes-editor"></ul>
          <div class="input-with-button">
            <input id="next-note-input" type="text" placeholder="次に会ったら聞きたいこと">
            <button type="button" id="add-next-note-btn" class="secondary-button">追加</button>
          </div>
          <p class="form-hint">
            チェック（完了）操作は人物・グループの詳細画面や記録詳細画面から行えます。
          </p>
        </section>

        <div class="form-actions">
          <button type="submit" class="primary-button full-width">保存</button>
        </div>
      </form>
    </div>
  `;

  function renderNextNotesList() {
    const list = root.querySelector('#next-notes-list');
    list.innerHTML = nextNotesState.length
      ? nextNotesState
          .map(
            (n) => `
        <li class="next-note-row" data-id="${n.id}">
          <span class="next-note-row__text ${n.done ? 'is-done' : ''}">
            ${n.done ? '✓ ' : '□ '}${escapeHtml(n.text)}
          </span>
          <button type="button" class="next-note-row__remove" data-remove-note="${n.id}" aria-label="削除">✕</button>
        </li>`
          )
          .join('')
      : `<li class="empty-hint">まだありません</li>`;

    list.querySelectorAll('[data-remove-note]').forEach((btn) => {
      btn.addEventListener('click', () => {
        nextNotesState = nextNotesState.filter((n) => n.id !== btn.dataset.removeNote);
        renderNextNotesList();
      });
    });
  }
  renderNextNotesList();

  function addNextNoteFromInput() {
    const input = root.querySelector('#next-note-input');
    const text = input.value.trim();
    if (!text) return;
    nextNotesState.push({ id: uuid(), text, done: false, doneAt: null });
    input.value = '';
    renderNextNotesList();
    input.focus();
  }
  root.querySelector('#add-next-note-btn').addEventListener('click', addNextNoteFromInput);
  root.querySelector('#next-note-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNextNoteFromInput();
    }
  });

  root.querySelector('#gen-title-btn').addEventListener('click', () => {
    const text = root.querySelector('#text-input').value;
    root.querySelector('#title-input').value = generateTitle(text);
  });

  root.querySelector('#add-person-inline').addEventListener('click', async () => {
    const name = prompt('人物の名前を入力してください');
    if (!name || !name.trim()) return;
    try {
      const p = await addPerson({ name });
      root.querySelector('#person-checks').insertAdjacentHTML('beforeend', chipHTML(p, true));
      removeEmptyHint(root.querySelector('#person-checks'));
    } catch (e) {
      alert(e.message);
    }
  });

  root.querySelector('#add-group-inline').addEventListener('click', async () => {
    const name = prompt('グループの名前を入力してください');
    if (!name || !name.trim()) return;
    try {
      const g = await addGroup({ name });
      root.querySelector('#group-checks').insertAdjacentHTML('beforeend', chipHTML(g, true));
      removeEmptyHint(root.querySelector('#group-checks'));
    } catch (e) {
      alert(e.message);
    }
  });

  root.querySelector('#record-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = root.querySelector('#text-input').value.trim();
    if (!text) {
      alert('内容を入力してください。');
      return;
    }
    const personIds = [...root.querySelectorAll('#person-checks input[type=checkbox]:checked')].map((el) => el.value);
    const groupIds = [...root.querySelectorAll('#group-checks input[type=checkbox]:checked')].map((el) => el.value);
    let title = root.querySelector('#title-input').value.trim();
    if (!title) title = generateTitle(text);
    const topics = splitCsv(root.querySelector('#topics-input').value);
    const keyPoints = splitCsv(root.querySelector('#keypoints-input').value);
    const nextTimeNotes = nextNotesState;

    const submitBtn = root.querySelector('.primary-button');
    submitBtn.disabled = true;

    try {
      if (existing) {
        await updateRecord(existing.id, { text, title, topics, keyPoints, nextTimeNotes, personIds, groupIds });
        location.hash = `#/record/${existing.id}`;
      } else {
        const rec = await addRecord({ text, title, topics, keyPoints, nextTimeNotes, personIds, groupIds });
        location.hash = `#/record/${rec.id}`;
      }
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
      submitBtn.disabled = false;
    }
  });
}

function chipHTML(entity, checked) {
  return `<label class="chip">
    <input type="checkbox" value="${entity.id}" ${checked ? 'checked' : ''}>
    <span>${escapeHtml(entity.name)}</span>
  </label>`;
}

function emptyHint(text) {
  return `<p class="empty-hint" data-empty-hint>${escapeHtml(text)}</p>`;
}

function removeEmptyHint(container) {
  const hint = container.querySelector('[data-empty-hint]');
  if (hint) hint.remove();
}
