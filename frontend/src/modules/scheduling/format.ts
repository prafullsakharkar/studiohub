/** A plain day (`2026-12-25`) as people write it. It has no time, so it is read as that day in any zone. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '—';
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** A moment from the API (UTC) in the browser's zone. */
export function formatMoment(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** `2026-11-04T10:00` to `11:00` as a range on one line (the end shows its day only when it differs). */
export function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${start} – ${end}`;
  const sameDay = s.toDateString() === e.toDateString();
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `${formatMoment(start)} – ${time(e)}` : `${formatMoment(start)} – ${formatMoment(end)}`;
}

/** Hours with at most one decimal: 12 → "12 h", 6.5 → "6.5 h". */
export const formatHours = (hours: number) => `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;

/** A pay rate as the API sends it; `null` means the caller may not see it. */
export const formatRate = (rate: string | null | undefined) => (rate === null || rate === undefined ? '—' : `$${rate}/h`);
