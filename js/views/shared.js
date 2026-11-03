import { escapeHtml, formatDate } from '../lib/util.js';
import { recordHref } from '../lib/nav.js';

export function emptyHTML(message) {
  return `<p class="empty">${escapeHtml(message)}</p>`;
}

export function backLinkHTML(href, label) {
  return `<a href="${href}" class="back-link"><span class="back-link__chevron" aria-hidden="true">‹</span>${escapeHtml(label)}</a>`;
}

// 人物名の一覧（記録に紐づく人物。存在しないIDは無視）
export function personNames(record, peopleById) {
  return (record.personIds || []).map((id) => peopleById[id]?.name).filter(Boolean);
}

// 会話記録の表。列は「日付」「タイトル」（showPeople のときだけ「人物」を追加）。
// from を渡すと、記録詳細から「戻る」を押したときにこの画面へ戻れる。
export function recordTableHTML(records, { peopleById = {}, showPeople = false, from = null } = {}) {
  const rows = records
    .map((r) => {
      const href = recordHref(r.id, from);
      const names = showPeople ? personNames(r, peopleById) : [];
      return `<tr data-href="${href}">
        <td class="col-date">${escapeHtml(formatDate(r.createdAt))}</td>
        <td class="col-title"><a href="${href}"><span class="clamp">${escapeHtml(r.title || '（無題）')}</span></a></td>
        ${showPeople ? `<td class="col-people"><span class="clamp">${names.length ? escapeHtml(names.join('、')) : '—'}</span></td>` : ''}
      </tr>`;
    })
    .join('');

  return `<div class="table-wrap">
    <table class="table table--records ${showPeople ? 'table--with-people' : ''}">
      <thead>
        <tr>
          <th scope="col" class="col-date">日付</th>
          <th scope="col" class="col-title">タイトル</th>
          ${showPeople ? '<th scope="col" class="col-people">人物</th>' : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// 表の行全体をタップして遷移できるようにする（リンクや入力欄の上のタップは除く）。
// コンテナに1回だけ設定すればよく、中身を再描画しても有効なまま。
export function bindRowLinks(container) {
  container.addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, select, textarea, label')) return;
    const tr = e.target.closest('tr[data-href]');
    if (tr) location.hash = tr.dataset.href;
  });
}

// 最終記録日などの集計。records は削除されていない記録の配列。
export function statsByPerson(records) {
  const map = new Map();
  for (const r of records) {
    for (const pid of r.personIds || []) {
      const s = map.get(pid) || { count: 0, last: null };
      s.count += 1;
      if (r.createdAt && (!s.last || r.createdAt > s.last)) s.last = r.createdAt;
      map.set(pid, s);
    }
  }
  return map;
}
