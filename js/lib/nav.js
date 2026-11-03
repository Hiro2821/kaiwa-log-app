// 画面遷移の「戻り先」を決める小さなヘルパー。
//
// history.back() に頼ると、ホーム画面に追加したPWAで直接記録を開いた場合や
// 再読み込み後に、アプリの外へ戻ってしまう。そこで、記録詳細へ遷移するリンクに
// ?from=... を付けておき、戻り先をその値から決定的に決める。
//
//   from = 'people'            → 人物一覧
//   from = 'person:<id>'       → その人物の詳細
//   from = 'group:<id>'        → そのグループの詳細
//   from = 'search:<query>'    → 検索画面（検索語を復元）
//   from なし                   → ホーム

import { enc } from './util.js';

export function backTarget(from) {
  if (!from) return { href: '#/', label: 'ホーム' };
  if (from === 'people') return { href: '#/people', label: '人物' };
  const m = from.match(/^(person|group|search):(.*)$/s);
  if (!m) return { href: '#/', label: 'ホーム' };
  const [, kind, value] = m;
  if (kind === 'person') return { href: `#/people/${enc(value)}`, label: '人物' };
  if (kind === 'group') return { href: `#/groups/${enc(value)}`, label: 'グループ' };
  return { href: value ? `#/search?q=${encodeURIComponent(value)}` : '#/search', label: '検索' };
}

function withFrom(base, from) {
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}

export function recordHref(id, from) {
  return withFrom(`#/record/${enc(id)}`, from);
}

export function recordEditHref(id, from) {
  return withFrom(`#/record/${enc(id)}/edit`, from);
}

// 下部タブのどれを選択状態にするか
export function tabForFrom(from) {
  return from && (from === 'people' || from.startsWith('person:')) ? 'people' : 'home';
}
