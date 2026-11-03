import { escapeHtml } from '../lib/util.js';

// アプリ内シート（モーダル）の共通部品。
// ブラウザ標準の alert / confirm / prompt の代わりに、見た目を統一して使う。
// 結果はPromiseで返す。背景タップ・Escapeキーで閉じた場合は dismissValue（既定 null）。
// データの保存・削除には一切関与しない（呼び出し側が行う）。

let activeClose = null;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.description]
 * @param {string} [opts.bodyHTML]
 * @param {Array<{label:string, role?:'primary'|'danger'|'secondary', value?:any,
 *                validate?:(el:HTMLElement)=>boolean, collect?:(el:HTMLElement)=>any}>} [opts.buttons]
 * @param {(el:HTMLElement, close:(value:any)=>void)=>void} [opts.onOpen]
 * @param {any} [opts.dismissValue]
 * @param {boolean} [opts.tall]
 */
export function openSheet({
  title,
  description = '',
  bodyHTML = '',
  buttons = [],
  onOpen = null,
  dismissValue = null,
  tall = false,
}) {
  return new Promise((resolve) => {
    // 同時に複数開かないよう、既存のシートがあれば先に閉じる
    if (activeClose) activeClose();

    const previouslyFocused = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet ${tall ? 'sheet--tall' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title" class="sheet__title">${escapeHtml(title)}</h2>
        ${description ? `<p class="sheet__desc">${escapeHtml(description)}</p>` : ''}
        <div class="sheet__body">${bodyHTML}</div>
        ${
          buttons.length
            ? `<div class="sheet__actions">${buttons
                .map(
                  (b, i) =>
                    `<button type="button" class="btn btn--${b.role || 'secondary'}" data-sheet-btn="${i}">${escapeHtml(b.label)}</button>`
                )
                .join('')}</div>`
            : ''
        }
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add('is-sheet-open');

    const sheet = overlay.querySelector('.sheet');

    // iOSでキーボード表示時にシートが画面外に隠れないよう、
    // 実際に見えている領域（visualViewport）の高さにオーバーレイを合わせる。
    function syncViewportHeight() {
      const vv = window.visualViewport;
      overlay.style.height = `${vv ? vv.height : window.innerHeight}px`;
      overlay.style.top = `${vv ? vv.offsetTop : 0}px`;
    }
    syncViewportHeight();
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('scroll', syncViewportHeight);

    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('scroll', syncViewportHeight);
      document.removeEventListener('keydown', onKeydown, true);
      document.body.classList.remove('is-sheet-open');
      overlay.remove();
      activeClose = null;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          /* フォーカス復帰に失敗しても動作に影響しない */
        }
      }
      resolve(value);
    }
    activeClose = () => close(dismissValue);

    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(dismissValue);
        return;
      }
      // 1行入力でEnter → 主ボタンを押す。ただし日本語入力の変換確定のEnterは無視する。
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
        const t = e.target;
        if (t instanceof HTMLInputElement && t.type !== 'checkbox' && t.type !== 'radio' && t.type !== 'search') {
          const primary = sheet.querySelector('.btn--primary, .btn--danger');
          if (primary) {
            e.preventDefault();
            primary.click();
          }
        }
      }
    }
    document.addEventListener('keydown', onKeydown, true);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(dismissValue); // 背景タップで閉じる
    });

    sheet.querySelectorAll('[data-sheet-btn]').forEach((el) => {
      el.addEventListener('click', () => {
        const b = buttons[Number(el.dataset.sheetBtn)];
        if (b.validate && !b.validate(sheet)) return;
        close(b.collect ? b.collect(sheet) : b.value ?? null);
      });
    });

    // フォーカスはユーザー操作と同じタイミングで同期的に行う必要がある
    // （iOS Safariは、操作から離れたタイミングのfocus()ではキーボードが開かないことがある）。
    if (onOpen) onOpen(sheet, close);
  });
}

// 確認ダイアログ。OKなら true、キャンセル／背景タップなら false。
export function showConfirmModal({
  title,
  message = '',
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  danger = false,
}) {
  return openSheet({
    title,
    description: message,
    buttons: [
      { label: cancelLabel, role: 'secondary', value: false },
      { label: confirmLabel, role: danger ? 'danger' : 'primary', value: true },
    ],
    dismissValue: false,
  }).then((v) => v === true);
}

// 情報表示（OKボタンのみ）。
export function showInfoModal({ title, message = '', bodyHTML = '', buttonLabel = '閉じる' }) {
  return openSheet({
    title,
    description: message,
    bodyHTML,
    buttons: [{ label: buttonLabel, role: 'primary', value: true }],
    dismissValue: true,
  });
}

// 人物の追加・編集フォーム。保存なら { name, memo }、キャンセルなら null。
export function showPersonFormModal({ title, name = '', memo = '', confirmLabel = '保存' }) {
  return openSheet({
    title,
    bodyHTML: `
      <label class="field-label" for="sheet-person-name">名前</label>
      <input id="sheet-person-name" class="field" type="text" value="${escapeHtml(name)}"
             placeholder="例：山田さん" autocomplete="off" autocapitalize="off" enterkeyhint="done">
      <p class="field-error" id="sheet-person-error" role="alert" hidden>名前を入力してください。</p>
      <label class="field-label" for="sheet-person-memo">メモ（任意）</label>
      <textarea id="sheet-person-memo" class="field field--textarea" rows="3"
                placeholder="例：同じ学年のサークルの人">${escapeHtml(memo)}</textarea>`,
    buttons: [
      { label: 'キャンセル', role: 'secondary', value: null },
      {
        label: confirmLabel,
        role: 'primary',
        validate: (el) => {
          const ok = el.querySelector('#sheet-person-name').value.trim() !== '';
          el.querySelector('#sheet-person-error').hidden = ok;
          if (!ok) el.querySelector('#sheet-person-name').focus();
          return ok;
        },
        collect: (el) => ({
          name: el.querySelector('#sheet-person-name').value.trim(),
          memo: el.querySelector('#sheet-person-memo').value.trim(),
        }),
      },
    ],
    onOpen: (el) => el.querySelector('#sheet-person-name').focus(),
  });
}

// グループの追加・編集フォーム（人物と同じ形）。
export function showGroupFormModal(opts) {
  return showPersonFormModal(opts);
}
