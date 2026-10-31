/**
 * Exhaustive field list for the hand-written `TeamMembership` row type in `directory.ts`. It lives outside
 * `__tests__` because tsconfig excludes tests from `tsc`: `Record<keyof T, true>` only fails to compile when this
 * file is compiled. The contract test then compares the list with the captured responses.
 */
import type { TeamMembership } from './directory';

export const TEAM_MEMBERSHIP_KEYS: Record<keyof TeamMembership, true> = {
  created_at: true,
  id: true,
  person: true,
  person_department_name: true,
  person_name: true,
  person_office_name: true,
  person_status: true,
  team: true,
  team_name: true,
  updated_at: true,
};
