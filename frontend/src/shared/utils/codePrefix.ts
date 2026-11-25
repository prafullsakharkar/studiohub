/**
 * A new record's code starts with a fixed prefix: a production record with its project's (`TST_SQ0010`,
 * `modules/production/codePrefix.ts`), a studio record with its kind's (`DEPT-LGT`, below). The form shows the prefix
 * beside the input and adds it on save; a record that exists keeps its code as it is. The backend enforces both (CR-49, CR-56).
 */

/** The prefix of each studio record's code, as the seeded and imported records have them (`init_platform`, `scripts/atom`). */
export const STUDIO_CODE_PREFIX = {
  department: 'DEPT-',
  team: 'TEAM-',
  position: 'POS-',
  office: 'OFF-',
  client: 'CLI-',
  vendor: 'VEN-',
} as const;

/** `typed` with `prefix` in front, upper case; a code that already starts with it is kept; empty stays empty. */
export function withCodePrefix(prefix: string | undefined | null, typed: unknown): string {
  const code = String(typed ?? '').trim().toUpperCase();
  const front = String(prefix ?? '').trim().toUpperCase();
  if (!code || !front || code.startsWith(front)) return code;
  return `${front}${code}`;
}
