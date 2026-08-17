import { reassignPersonInRecords, reassignGroupInRecords } from '../db/records.js';
import { deletePerson } from '../db/people.js';
import { deleteGroup } from '../db/groups.js';

export async function mergePersonInto(sourceId, targetId) {
  if (sourceId === targetId) return;
  await reassignPersonInRecords(sourceId, targetId);
  await deletePerson(sourceId);
}

export async function mergeGroupInto(sourceId, targetId) {
  if (sourceId === targetId) return;
  await reassignGroupInRecords(sourceId, targetId);
  await deleteGroup(sourceId);
}
