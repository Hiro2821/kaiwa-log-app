import { addRecord, updateRecord, getRecord } from '../db/records.js';
import { listPeople } from '../db/people.js';
import { getSetting, setSetting } from '../db/settings.js';
import { generateTitle } from '../lib/autoTitle.js';
import { escapeHtml } from '../lib/util.js';
import { backTarget, recordHref } from '../lib/nav.js';
import { backLinkHTML, emptyHTML } from './shared.js';
import { showPersonPicker } from './personPicker.js';

// 新規記録・記録の編集フォーム。
// 入力に集中できるよう、項目は「人物」「タイトル」「会話内容」だけにしている。
//
// 更新時は { text, title, personIds } だけを渡す。groupIds・topics・keyPoints・nextTimeNotes など
// この画面で扱わない項目は updateRecord() の仕様でそのまま保持され、失われない。
export async function renderRecordForm(root, params = {}, query) {
  const editingId = params.id || null;
  const from = query?.get?.('from') || null;
  const existing = editingId ? await getRecord(editingId) : null;

  if (editingId && !existing) {
    root.innerHTML = `
      <div class="page">
        <header class="page-header page-header--nav">${backLinkHTML('#/', 'ホーム')}</header>
        ${emptyHTML('記録が見つかりませんでした。')}
      </div>`;
    return;
  }

  let people = await listPeople();
  const knownIds = new Set(people.map((p) => p.id));
  const presetPersonId = query?.get?.('personId') || null;

  // 新規作成中の入力は下書きとして自動保存する（誤ってタブを切り替えても本文が消えない）。
  // 人物を指定して開いた場合は、その人物用の下書きを別に持つ。
  const draftKey = `draft:new:${presetPersonId || ''}`;
  let draft = null;
  if (!existing) {
    try {
      draft = await getSetting(draftKey);
    } catch {
      draft = null;
    }
  }

  const selected = new Set(
    existing
      ? existing.personIds || []
      : draft?.personIds ?? (presetPersonId && knownIds.has(presetPersonId) ? [presetPersonId] : [])
  );

  const initialTitle = existing ? existing.title || '' : draft?.title || '';
  const initialText = existing ? existing.text || '' : draft?.text || '';
  const restoredDraft = !existing && !!(draft && (draft.text || draft.title));

  const back = existing
    ? backLinkHTML(recordHref(existing.id, from), '記録')
    : from
      ? backLinkHTML(backTarget(from).href, backTarget(from).label)
      : '';

  root.innerHTML = `
    <div class="page">
      ${back ? `<header class="page-header page-header--nav">${back}</header>` : ''}
      <header class="page-header">
        <h1 class="page-title">${existing ? '記録を編集' : '新規記録'}</h1>
      </header>

      <form id="record-form" novalidate>
        <div class="form-group">
          <span class="field-label" id="person-label">人物</span>
          <button type="button" class="select-field" id="person-field" aria-labelledby="person-label person-value">
            <span class="select-field__value" id="person-value"></span>
            <span class="select-field__chevron" aria-hidden="true">›</span>
          </button>
        </div>

        <div class="form-group">
          <label class="field-label" for="title-input">タイトル</label>
          <input id="title-input" class="field" type="text" value="${escapeHtml(initialTitle)}"
                 placeholder="空欄なら本文から自動で付けます" autocomplete="off" enterkeyhint="next">
        </div>

        <div class="form-group">
          <label class="field-label" for="text-input">会話内容</label>
          <textarea id="text-input" class="field field--textarea field--body"
                    placeholder="話したことを入力">${escapeHtml(initialText)}</textarea>
          <p class="field-error" id="form-error" role="alert" hidden></p>
          ${
            restoredDraft
              ? `<p class="caption" id="draft-note">下書きを復元しました。<button type="button" class="link-button" id="discard-draft">破棄</button></p>`
              : ''
          }
        </div>

        <div class="actions">
          <button type="submit" class="btn btn--primary btn--block" id="save-btn">保存</button>
        </div>
      </form>
    </div>
  `;

  const form = root.querySelector('#record-form');
  const titleInput = root.querySelector('#title-input');
  const textInput = root.querySelector('#text-input');
  const errorEl = root.querySelector('#form-error');
  const personValue = root.querySelector('#person-value');
  const saveBtn = root.querySelector('#save-btn');

  // ---- 人物選択 ----
  function renderPersonValue() {
    const names = people.filter((p) => selected.has(p.id)).map((p) => p.name);
    personValue.textContent = names.length ? names.join('、') : '選択なし';
    personValue.classList.toggle('is-placeholder', names.length === 0);
  }
  renderPersonValue();

  root.querySelector('#person-field').addEventListener('click', async () => {
    const result = await showPersonPicker({ people, selectedIds: [...selected], multiple: true, title: '人物を選択' });
    if (!result) return;
    people = result.people;
    selected.clear();
    result.ids.forEach((id) => selected.add(id));
    renderPersonValue();
    scheduleDraftSave();
  });

  // ---- 本文欄の高さを内容に合わせて広げる ----
  function autosize() {
    textInput.style.height = 'auto';
    textInput.style.height = `${textInput.scrollHeight}px`;
  }
  autosize();

  // ---- 下書きの自動保存（新規作成時のみ） ----
  let saved = false; // 保存済みなら下書きを書き戻さない
  let draftTimer = null;
  async function writeDraft() {
    if (existing || saved) return;
    const title = titleInput.value;
    const text = textInput.value;
    try {
      if (text.trim() || title.trim()) {
        await setSetting(draftKey, { title, text, personIds: [...selected], savedAt: new Date().toISOString() });
      } else {
        await setSetting(draftKey, null);
      }
    } catch {
      /* 下書きの保存失敗は入力の妨げにしない */
    }
  }
  function scheduleDraftSave() {
    if (existing) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, 300);
  }
  if (!existing) {
    // 画面を離れる直前の入力も取りこぼさない
    const flush = () => {
      clearTimeout(draftTimer);
      writeDraft();
    };
    // 画面を離れたらハンドラを必ず外す（古い入力内容が、あとから書き戻されるのを防ぐ）
    const onLeave = () => {
      flush();
      window.removeEventListener('pagehide', flush);
    };
    window.addEventListener('hashchange', onLeave, { once: true });
    window.addEventListener('pagehide', flush);
  }

  textInput.addEventListener('input', () => {
    autosize();
    errorEl.hidden = true;
    scheduleDraftSave();
  });
  titleInput.addEventListener('input', scheduleDraftSave);

  // タイトル欄のEnterは「保存」ではなく本文欄への移動にする（誤保存の防止）。
  // 日本語入力の変換確定のEnterは何もしない。
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      textInput.focus();
    }
  });

  root.querySelector('#discard-draft')?.addEventListener('click', async () => {
    titleInput.value = '';
    textInput.value = '';
    selected.clear();
    if (presetPersonId && knownIds.has(presetPersonId)) selected.add(presetPersonId);
    renderPersonValue();
    autosize();
    root.querySelector('#draft-note')?.remove();
    await setSetting(draftKey, null);
  });

  // ---- 保存 ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text) {
      errorEl.textContent = '会話内容を入力してください。';
      errorEl.hidden = false;
      textInput.focus();
      return;
    }
    const title = titleInput.value.trim() || generateTitle(text);
    const personIds = [...selected];

    saveBtn.disabled = true;
    try {
      if (existing) {
        await updateRecord(existing.id, { text, title, personIds });
        saved = true;
        location.hash = recordHref(existing.id, from);
      } else {
        const rec = await addRecord({ text, title, personIds });
        saved = true;
        clearTimeout(draftTimer);
        await setSetting(draftKey, null);
        location.hash = recordHref(rec.id, from);
      }
    } catch (err) {
      errorEl.textContent = `保存に失敗しました: ${err.message}`;
      errorEl.hidden = false;
      saveBtn.disabled = false;
    }
  });
}
