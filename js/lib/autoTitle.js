// タイトル自動生成。
// 生成AI・外部APIは一切使用しない。本文冒頭の一文（または先頭N文字）を
// そのまま抜き出す単純な処理であり、要約や意味解釈は行わない。

const MAX_LENGTH = 24;

export function generateTitle(text) {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  const firstLine = trimmed.split('\n')[0].trim();

  // 句点・感嘆符・疑問符（全角/半角）で最初の一文を抜き出す
  const sentenceMatch = firstLine.match(/^(.*?[。.!?！？])/);
  let candidate = sentenceMatch ? sentenceMatch[1] : firstLine;

  if (!candidate) {
    candidate = trimmed;
  }

  if (candidate.length > MAX_LENGTH) {
    candidate = candidate.slice(0, MAX_LENGTH) + '…';
  }

  return candidate;
}
