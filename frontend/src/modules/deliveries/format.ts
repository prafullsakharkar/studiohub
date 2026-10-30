const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** 1,536 → "1.5 KB". The delivery totals are bytes. */
export function formatBytes(bytes: number | null | undefined): string {
  let value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value >= 10 ? 0 : 1)} ${UNITS[unit]}`;
}

export const formatWhen = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleString() : '—');
export const formatDay = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleDateString() : '—');
