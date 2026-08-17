// 全記録を対象にした単純な部分一致検索。
// 日本語は分かち書きせず、大文字小文字を無視した部分一致で行う
// （想定件数が個人利用規模のため、これで実用上十分と判断。設計書 v1.1 6章参照）。

export function searchRecords(records, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return records.filter((r) => {
    const haystack = [
      r.title,
      r.text,
      r.rawVoiceText,
      ...(r.topics || []),
      ...(r.keyPoints || []),
      ...(r.nextTimeNotes || []).map((n) => n.text),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
