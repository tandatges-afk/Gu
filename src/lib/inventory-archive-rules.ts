/** Fail closed on stale or malformed day-interval documents.
 * Archive must not proceed while any legacy or V5 reservation lock remains.
 * The caller MUST make the reads under the same PostgreSQL transaction lock
 * as all rental writes; these pure rules alone do not provide atomicity.
 */
export function mayArchiveItem(legacyOccupied:boolean, hourlyDocuments:readonly unknown[]):boolean {
 if(legacyOccupied)return false;
 return hourlyDocuments.every(document=>{
  if(!document||typeof document!=='object'||Array.isArray(document))return false;
  const entries=(document as {entries?:unknown}).entries;
  return Array.isArray(entries)&&entries.length===0;
 });
}
