import { listRecordsByPerson } from '../db/records.js';

// 人物詳細画面の中心データを組み立てる。
// アプリの目的（次の会話に活かせること）に直結する部分のため、
// 「最近の会話」「過去の話題（頻度順）」「次回確認したいこと」の3つを必ず返す。
export async function getPersonSummary(personId, { recentCount = 5 } = {}) {
  const records = await listRecordsByPerson(personId); // 作成日時の新しい順・削除済みは除外済み
  const recent = records.slice(0, recentCount);

  const topicFreq = new Map();
  const nextTimeNotes = [];

  for (const r of records) {
    for (const t of r.topics || []) {
      topicFreq.set(t, (topicFreq.get(t) || 0) + 1);
    }
    for (const n of r.nextTimeNotes || []) {
      nextTimeNotes.push({
        id: n.id,
        text: n.text,
        done: !!n.done,
        recordId: r.id,
        createdAt: r.createdAt,
      });
    }
  }

  const topics = [...topicFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));

  return {
    recent,
    topics,
    nextTimeNotes,
    totalCount: records.length,
  };
}
