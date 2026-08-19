import { exportBackup, importBackup } from '../lib/backup.js';
import { getSetting } from '../db/settings.js';
import { formatDateTime } from '../lib/util.js';

export async function renderSettings(root) {
  root.innerHTML = `<div class="view"><p class="loading">読み込み中…</p></div>`;
  const lastBackupAt = await getSetting('lastBackupAt');

  root.innerHTML = `
    <div class="view view--settings">
      <header class="view-header">
        <a href="#/" class="back-link" aria-label="戻る">←</a>
        <h1>設定</h1>
      </header>

      <section class="settings-card">
        <h2>データ</h2>
        <p class="backup-note">
          記録はこの端末内（ブラウザのIndexedDB）にのみ保存されています。
          端末の不具合、アプリの削除、ブラウザのデータ消去などにより、
          記録が失われる可能性があります。定期的なバックアップをおすすめします。
        </p>
        <p class="backup-status">
          最後にバックアップした日時：
          <strong>${lastBackupAt ? formatDateTime(lastBackupAt) : 'まだバックアップしていません'}</strong>
        </p>
        <button id="export-btn" class="primary-button full-width">JSONを書き出す</button>

        <div class="import-group">
          <p class="import-group__title">JSONを読み込む</p>

          <label for="import-merge-file" class="secondary-button full-width">
            バックアップを追加で読み込む
          </label>
          <p class="import-group__desc">
            現在のデータは残したまま、バックアップの内容を追加します（同じIDのものは上書き）。
          </p>
          <input type="file" id="import-merge-file" accept="application/json" style="display:none">

          <label for="import-replace-file" class="danger-button full-width">
            バックアップから復元する（現在のデータを置き換え）
          </label>
          <p class="import-group__desc import-group__desc--danger">
            現在の人物・グループ・記録をすべて削除し、バックアップの内容だけに置き換えます。
            バックアップに含まれていない現在のデータは失われます。元に戻せません。
          </p>
          <input type="file" id="import-replace-file" accept="application/json" style="display:none">
        </div>
      </section>

      <section class="settings-card">
        <h2>管理</h2>
        <div class="settings-links">
          <a href="#/people" class="settings-link">人物を管理</a>
          <a href="#/groups" class="settings-link">グループを管理</a>
          <a href="#/trash" class="settings-link">ゴミ箱</a>
        </div>
      </section>

      <section class="settings-card">
        <h2>その他</h2>
        <p class="app-info">
          <strong>会話記録</strong>（Phase 1）<br>
          人と話した内容を記録し、次に会うときに思い出せるようにするための個人用メモアプリです。<br>
          記録はすべてこの端末内に保存され、外部サーバーには送信されません。
        </p>
      </section>
    </div>
  `;

  root.querySelector('#export-btn').addEventListener('click', async () => {
    try {
      await exportBackup();
      alert('バックアップを書き出しました。');
      renderSettings(root);
    } catch (e) {
      alert('書き出しに失敗しました: ' + e.message);
    }
  });

  root.querySelector('#import-merge-file').addEventListener('change', (e) =>
    handleImportFile(e, {
      mode: 'merge',
      confirmMessage:
        'バックアップの内容を追加で読み込みます。現在のデータは残ります（同じIDのものは上書きされます）。よろしいですか？',
    })
  );

  root.querySelector('#import-replace-file').addEventListener('change', (e) =>
    handleImportFile(e, {
      mode: 'replace',
      confirmMessage:
        '現在の人物・グループ・記録をすべて削除し、バックアップの内容だけに置き換えます。\n' +
        'この操作は元に戻せません。本当によろしいですか？\n' +
        '（不安な場合は、先に「データを書き出す」で現在の状態も保存しておいてください）',
    })
  );

  async function handleImportFile(e, { mode, confirmMessage }) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm(confirmMessage)) {
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const result = await importBackup(text, { mode });
      const modeLabel = mode === 'replace' ? '復元（置き換え）' : '追加読み込み';
      alert(
        `${modeLabel}が完了しました。\n人物: ${result.peopleCount}件\nグループ: ${result.groupsCount}件\n記録: ${result.recordsCount}件`
      );
      location.hash = '#/';
    } catch (err) {
      alert('読み込みに失敗しました: ' + err.message);
    } finally {
      e.target.value = '';
    }
  }
}
