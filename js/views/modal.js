import { escapeHtml } from '../lib/util.js';

// アプリ内モーダル（テキスト入力用）。
// ブラウザ標準の prompt() の代わりに使う、見た目だけを差し替える共通部品。
// prompt() と同じ感覚で使えるよう、入力された文字列（トリム済み）を
// 解決するPromiseを返す。キャンセル・空文字・背景タップ・Escapeキーの場合は null。
//
// 現時点では「人物を追加」の入力にのみ使用している（ご指定の範囲に合わせているため）。
// データの保存処理には一切関与しない（呼び出し側が従来どおり addPerson() 等を呼ぶ）。

let activeCleanup = null;

export function showTextInputModal({
  title,
  description = '',
  placeholder = '',
  initialValue = '',
  confirmLabel = '追加',
  cancelLabel = 'キャンセル',
} = {}) {
  return new Promise((resolve) => {
    // 同時に複数開かないよう、既存のモーダルがあれば先に閉じる
    if (activeCleanup) activeCleanup();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="modal-sheet-title">
        <h2 id="modal-sheet-title" class="modal-sheet__title">${escapeHtml(title)}</h2>
        ${description ? `<p class="modal-sheet__desc">${escapeHtml(description)}</p>` : ''}
        <input type="text" class="modal-sheet__input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(initialValue)}">
        <div class="modal-sheet__actions">
          <button type="button" class="modal-sheet__cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="modal-sheet__confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const input = overlay.querySelector('.modal-sheet__input');
    const cancelBtn = overlay.querySelector('.modal-sheet__cancel');
    const confirmBtn = overlay.querySelector('.modal-sheet__confirm');

    // iOSでキーボード表示時にモーダルが画面外に隠れないよう、
    // 実際に見えている領域（visualViewport）の高さに合わせてオーバーレイの高さを追従させる。
    function syncViewportHeight() {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      overlay.style.height = `${vh}px`;
    }
    syncViewportHeight();
    window.visualViewport?.addEventListener('resize', syncViewportHeight);

    function cleanup(result) {
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      document.body.style.overflow = '';
      overlay.remove();
      activeCleanup = null;
      resolve(result);
    }
    activeCleanup = () => cleanup(null);

    function handleConfirm() {
      const value = input.value.trim();
      cleanup(value || null);
    }

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null); // 背景タップで閉じる
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        cleanup(null);
      }
    });

    // フォーカスはユーザー操作（クリック）と同じタイミングで同期的に行う
    // （iOS Safariは、ユーザー操作から離れたタイミングでのfocus()だと
    //   キーボードが自動で開かないことがあるための対策）。
    input.focus();

    // 表示アニメーションだけを次のフレームに回す
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
    });
  });
}
