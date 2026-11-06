/**
 * New production records carry the project's code in their own: sequence `0010` in project `TST` is `TST_0010`, and
 * `SQ0010` is `TST_SQ0010`. The form and the Bulk add screens add the prefix; nothing is renamed on a record that
 * exists. The backend does not require it yet (docs/sync/backend-change-requests.md, CR-49).
 */
export const projectCodePrefix = (projectCode: string | undefined | null): string => {
  const code = String(projectCode ?? '').trim().toUpperCase();
  return code ? `${code}_` : '';
};

/** `typed` with the project prefix in front, upper case; a code that already starts with it is kept; empty stays empty. */
export function withProjectPrefix(projectCode: string | undefined | null, typed: unknown): string {
  const code = String(typed ?? '').trim().toUpperCase();
  const prefix = projectCodePrefix(projectCode);
  if (!code || !prefix || code.startsWith(prefix)) return code;
  return `${prefix}${code}`;
}
