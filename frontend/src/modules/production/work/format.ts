/**
 * Hours arrive as JSON numbers on timelog reads and as decimal strings on writes and on tasks
 * (docs/sync/backend-change-requests.md, Phase 6 notes). Everything is read through `toHours`.
 */
export const toHours = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const formatHours = (value: number | string | null | undefined): string => `${toHours(value).toFixed(2).replace(/\.?0+$/, '')}h`;

/** Today as the `YYYY-MM-DD` the API takes, in the user's own calendar. */
export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
