import { listRecordsByGroup } from '../db/records.js';

export async function getGroupSummary(groupId, { recentCount = 5 } = {}) {
  const records = await listRecordsByGroup(groupId);
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
