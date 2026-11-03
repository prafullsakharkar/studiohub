import { useSyncExternalStore } from 'react';

/**
 * The studio's default localization (`GET /localizations/default/`, Q-22), as the formatters need it. Everything is shown in
 * the browser's own time zone: the zone the studio chose is NOT applied, because the calendar groups and windows days in
 * browser time and showing clock times in another zone would put an event on a different day than its column.
 */
export interface StudioLocale {
  date_format: string;
  time_format: string;
  number_format: string;
  week_start: number;
}

const DATE_FORMATS = ['YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY'];

/** A response is only trusted when it has the fields we read, so an unexpected body leaves the browser's own formats. */
export function toStudioLocale(value: unknown): StudioLocale | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.date_format !== 'string' || !DATE_FORMATS.includes(v.date_format)) return null;
  if (v.time_format !== '24H' && v.time_format !== '12H') return null;
  if (v.number_format !== 'dot' && v.number_format !== 'comma') return null;
  return { date_format: v.date_format, time_format: v.time_format, number_format: v.number_format, week_start: v.week_start === 0 ? 0 : 1 };
}

let active: StudioLocale | null = null;
const listeners = new Set<() => void>();

export function setStudioLocale(next: StudioLocale | null): void {
  if (next === active) return;
  active = next;
  for (const listener of listeners) listener();
}

export const getStudioLocale = (): StudioLocale | null => active;

/** Re-renders the caller when the studio locale changes. */
export function useStudioLocale(): StudioLocale | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStudioLocale,
    getStudioLocale
  );
}

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A date such as 03/11/2026, in the studio's date format. Without a studio locale: the browser's own. */
export function formatDate(value: string | number | Date | null | undefined, empty = '—'): string {
  const d = toDate(value);
  if (!d) return empty;
  if (!active) return d.toLocaleDateString();
  return active.date_format.replace('YYYY', String(d.getFullYear())).replace('MM', pad(d.getMonth() + 1)).replace('DD', pad(d.getDate()));
}

/** A clock time, 24-hour (14:30) or 12-hour (2:30 PM) as the studio chose. Without a studio locale: the browser's own. */
export function formatTime(value: string | number | Date | null | undefined, empty = '—'): string {
  const d = toDate(value);
  if (!d) return empty;
  if (!active) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (active.time_format === '24H') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const hours = d.getHours() % 12 || 12;
  return `${hours}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** Date and time together. Without a studio locale: the browser's own. */
export function formatDateTime(value: string | number | Date | null | undefined, empty = '—'): string {
  const d = toDate(value);
  if (!d) return empty;
  if (!active) return d.toLocaleString();
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** A number with the studio's separators: 1,234.56 (dot) or 1.234,56 (comma). Without a studio locale: the browser's own. */
export function formatNumber(value: number): string {
  if (!active) return value.toLocaleString();
  return value.toLocaleString(active.number_format === 'comma' ? 'de-DE' : 'en-US');
}
