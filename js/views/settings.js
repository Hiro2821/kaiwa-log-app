import { exportBackup, planImport, applyImport } from '../lib/backup.js';
import { getSetting } from '../db/settings.js';
import { listPeople } from '../db/people.js';
import { listGroups } from '../db/groups.js';
import { listAllRecords, listTrashedRecords } from '../db/records.js';
import { escapeHtml, formatDateTime } from '../lib/util.js';
import { backLinkHTML } from './shared.js';
import { openSheet, showInfoModal } from './modal.js';

const APP_VERSION = '2.0';

// データ管理画面: バックアップの書き出し・読み込み、ゴミ箱、データ件数。
export async function renderSettings(root) {
  const [lastBackupAt, people, groups, records, trashed] = await Promise.all([
    getSetting('lastBackupAt'),
    listPeople(),
    listGroups(),
    listAllRecords(),
    listTrashedRecords(),
  ]);

  root.innerHTML = `
    <div class="page">
      <header class="page-header page-header--nav">${backLinkHTML('#/', 'ホーム')}</header>
      <header class="page-header"><h1 class="page-title">データ管理</h1></header>

      <section class="section">
        <h2 class="section__title">バックアップ</h2>
        <p class="body-note">
          記録はこの端末内（ブラウザのデータ領域）にのみ保存され、外部には送信されません。
          端末の故障・アプリの削除・ブラウザのデータ消去で失われる可能性があるため、定期的な書き出しをおすすめします。
        </p>
        <dl class="facts facts--single">
          <div class="facts__item">
            <dt>最後に書き出した日時</dt>
            <dd>${lastBackupAt ? escapeHtml(formatDateTime(lastBackupAt)) : 'まだ書き出していません'}</dd>
          </div>
        </dl>
        <div class="actions">
          <button type="button" class="btn btn--primary btn--block" id="export-btn">JSONを書き出す</button>
        </div>
      </section>

      <section class="section">
        <h2 class="section__title">読み込み</h2>
        <p class="body-note">
          書き出したJSONから、人物と記録を追加します。現在のデータは削除されません。
          取り込む前に、追加される件数と重複を確認できます。
        </p>
        <div class="actions">
          <label for="import-file" class="btn btn--secondary btn--block">JSONを読み込む</label>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </div>
      </section>

      <section class="section">
        <h2 class="section__title">保存されているデータ</h2>
        <ul class="link-list">
          <li><div class="link-list__row"><span>人物</span><span class="link-list__value">${people.length}人</span></div></li>
          <li><div class="link-list__row"><span>会話記録</span><span class="link-list__value">${records.length}件</span></div></li>
          <li><a class="link-list__row" href="#/trash"><span>ゴミ箱</span><span class="link-list__value">${trashed.length}件 ›</span></a></li>
          ${
            groups.length
              ? `<li><a class="link-list__row" href="#/groups"><span>グループ</span><span class="link-list__value">${groups.length}件 ›</span></a></li>`
              : ''
          }
        </ul>
      </section>

      <p class="caption caption--center">会話記録 ${APP_VERSION}</p>
    </div>
  `;

  const exportBtn = root.querySelector('#export-btn');
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    try {
      const { method } = await exportBackup();
      if (method !== 'cancelled') {
        await showInfoModal({
          title: 'バックアップを書き出しました',
          message:
            method === 'downloaded'
              ? 'ダウンロードされたファイルは、ファイルアプリなどで確認できます。'
              : '保存先を確認してください。',
        });
      }
    } catch (e) {
      await showInfoModal({ title: '書き出しに失敗しました', message: e.message });
    } finally {
      renderSettings(root);
    }
  });

  root.querySelector('#import-file').addEventListener('change', async (e) => {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    let plan;
    try {
      plan = await planImport(await file.text());
    } catch (err) {
      input.value = '';
      await showInfoModal({ title: '読み込めませんでした', message: err.message });
      return;
    }
    input.value = ''; // 同じファイルを続けて選べるようにする

    const choice = await showImportPreview(file.name, plan);
    if (!choice) return;

    try {
      const result = await applyImport(plan, { onConflict: choice.onConflict });
      await showInfoModal({
        title: '読み込みが完了しました',
        bodyHTML: importResultHTML(result),
      });
    } catch (err) {
      await showInfoModal({
        title: '読み込みに失敗しました',
        message: `データは変更されていません。（${err.message}）`,
      });
    }
    renderSettings(root);
  });
}

function summaryRow(label, value) {
  return `<div class="summary__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function importResultHTML(r) {
  const rows = [
    summaryRow('追加した人物', `${r.added.people}人`),
    summaryRow('追加した記録', `${r.added.records}件`),
  ];
  if (r.added.groups) rows.push(summaryRow('追加したグループ', `${r.added.groups}件`));
  if (r.updatedRecords) rows.push(summaryRow('更新した記録', `${r.updatedRecords}件`));
  if (r.skippedRecords) rows.push(summaryRow('スキップした記録', `${r.skippedRecords}件`));
  return `<dl class="summary">${rows.join('')}</dl>`;
}

// 取り込み前の確認シート。ここで「追加」を選ぶまでデータは一切変更されない。
function showImportPreview(fileName, plan) {
  const { people, groups, records } = plan;
  const skipRecords = records.identical.length + records.contentDuplicates.length;
  const skipOthers = people.identical.length + groups.identical.length;

  const rows = [
    summaryRow('追加される人物', `${people.add.length}人`),
    summaryRow('追加される記録', `${records.add.length}件`),
  ];
  if (groups.add.length) rows.push(summaryRow('追加されるグループ', `${groups.add.length}件`));
  if (skipRecords) rows.push(summaryRow('すでにある記録（スキップ）', `${skipRecords}件`));
  if (skipOthers) rows.push(summaryRow('すでにある人物・グループ（スキップ）', `${skipOthers}件`));

  const conflictBlock = plan.hasConflicts
    ? `<fieldset class="radio-group">
        <legend>同じIDで内容が異なる記録が${records.conflicts.length}件あります</legend>
        <label class="radio">
          <input type="radio" name="onConflict" value="skip" checked>
          <span>現在のデータを残す（推奨）</span>
        </label>
        <label class="radio">
          <input type="radio" name="onConflict" value="newer">
          <span>更新日時が新しい方を採用<small>採用されなかった側の内容は残りません。先にバックアップを書き出しておくと安心です。</small></span>
        </label>
      </fieldset>`
    : '';

  const warnings = plan.warnings.length
    ? `<ul class="warn-list">${plan.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`
    : '';

  const exportedAt = plan.meta.exportedAt ? `書き出し日時：${formatDateTime(plan.meta.exportedAt)}` : '';

  const bodyHTML = `
    <p class="sheet__file">${escapeHtml(fileName)}${exportedAt ? `<br>${escapeHtml(exportedAt)}` : ''}</p>
    ${
      plan.isEmpty
        ? '<p class="body-note">追加できる新しいデータはありませんでした。ファイルの内容はすべて、すでに保存されています。</p>'
        : `<dl class="summary">${rows.join('')}</dl>`
    }
    ${conflictBlock}
    ${warnings}
    ${plan.isEmpty ? '' : '<p class="caption">現在のデータは削除されません。</p>'}`;

  if (plan.isEmpty) {
    return openSheet({
      title: '読み込み内容の確認',
      bodyHTML,
      buttons: [{ label: '閉じる', role: 'primary', value: null }],
      dismissValue: null,
      tall: true,
    });
  }

  return openSheet({
    title: '読み込み内容の確認',
    bodyHTML,
    tall: true,
    buttons: [
      { label: 'キャンセル', role: 'secondary', value: null },
      {
        label: '読み込む',
        role: 'primary',
        collect: (el) => ({
          onConflict: el.querySelector('input[name="onConflict"]:checked')?.value || 'skip',
        }),
      },
    ],
    dismissValue: null,
  });
}
