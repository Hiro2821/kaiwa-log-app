import { addPerson } from '../db/people.js';
import { escapeHtml, normalizeForSearch } from '../lib/util.js';
import { openSheet } from './modal.js';

// 人物選択シート。名前で絞り込み、タップで選択する。
// 入力した名前の人物がいなければ、その場で新しい人物として追加もできる。
//
// 戻り値: { ids: string[], people: Person[] }  … キャンセル時は null
//   people は、この画面で新しく追加された人物を含む最新の人物一覧。
//   multiple: false のときは、1人をタップした時点で閉じて ids に1件だけ入れて返す。
export function showPersonPicker({
  people,
  selectedIds = [],
  multiple = true,
  title = '人物を選択',
  allowCreate = true,
  excludeIds = [],
  confirmLabel = '完了',
}) {
  const list = people.filter((p) => !excludeIds.includes(p.id));
  const selected = new Set(selectedIds);
  const allPeople = [...people]; // 戻り値用（除外した人物も含める）

  const buttons = multiple
    ? [
        { label: 'キャンセル', role: 'secondary', value: null },
        { label: confirmLabel, role: 'primary', collect: () => ({ ids: [...selected], people: allPeople }) },
      ]
    : [{ label: 'キャンセル', role: 'secondary', value: null }];

  return openSheet({
    title,
    tall: true,
    bodyHTML: `
      <input class="field picker__search" type="search" placeholder="名前で検索" autocomplete="off"
             autocapitalize="off" aria-label="人物を検索">
      <p class="field-error" id="picker-error" role="alert" hidden></p>
      <ul class="picker__list" role="listbox" aria-multiselectable="${multiple ? 'true' : 'false'}"></ul>`,
    buttons,
    onOpen(el, close) {
      const input = el.querySelector('.picker__search');
      const ul = el.querySelector('.picker__list');
      const errorEl = el.querySelector('#picker-error');

      function render() {
        const q = input.value.trim();
        const nq = normalizeForSearch(q);
        const items = list
          .filter((p) => !nq || normalizeForSearch(p.name).includes(nq))
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

        const exact = list.some((p) => normalizeForSearch(p.name) === nq);
        const rows = items.map(
          (p) => `<li role="option" aria-selected="${selected.has(p.id)}">
            <button type="button" class="picker__row" data-id="${escapeHtml(p.id)}">
              <span class="picker__name">${escapeHtml(p.name)}</span>
              <span class="picker__check" aria-hidden="true">${selected.has(p.id) ? '✓' : ''}</span>
            </button>
          </li>`
        );
        if (allowCreate && q && !exact) {
          rows.push(`<li><button type="button" class="picker__row picker__row--create" data-create="1">
            <span class="picker__name">「${escapeHtml(q)}」を新しい人物として追加</span>
          </button></li>`);
        }
        ul.innerHTML = rows.length
          ? rows.join('')
          : `<li class="picker__empty">${list.length ? '該当する人物がいません' : 'まだ人物が登録されていません'}</li>`;
      }

      ul.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        errorEl.hidden = true;

        if (btn.dataset.create) {
          try {
            const person = await addPerson({ name: input.value.trim() });
            list.push(person);
            allPeople.push(person);
            if (multiple) {
              selected.add(person.id);
              input.value = '';
              render();
            } else {
              close({ ids: [person.id], people: allPeople });
            }
          } catch (err) {
            errorEl.textContent = err.message;
            errorEl.hidden = false;
          }
          return;
        }

        const id = btn.dataset.id;
        if (!multiple) {
          close({ ids: [id], people: allPeople });
          return;
        }
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render();
      });

      input.addEventListener('input', render);
      render();
      // 一覧が長い場合に備えて検索欄にフォーカスする（iOSではキーボードが開く）
      if (list.length > 8) input.focus();
    },
  });
}
