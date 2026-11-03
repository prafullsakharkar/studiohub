import { afterEach, describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { formatDate, formatDateTime, formatNumber, formatTime, getStudioLocale, setStudioLocale, toStudioLocale } from '../studioLocale';

type Captured = { status: number; body: Record<string, unknown> };
const flow = loadSample<Record<string, Captured>>('settings/_flow.json');
/** The two localizations the live backend answered with: English (UK) 12-hour, and English (India) 24-hour. */
const uk = flow.locales_default.body;
const india = flow.locales_default_after.body;

// 3 November 2026, 14:07 and 00:05 and 12:00, in the zone the tests run in (the formatters use the browser's zone).
const afternoon = new Date(2026, 10, 3, 14, 7);
const midnight = new Date(2026, 10, 3, 0, 5);
const noon = new Date(2026, 10, 3, 12, 0);

afterEach(() => setStudioLocale(null));

describe('toStudioLocale', () => {
  it('reads the captured default localizations', () => {
    expect(toStudioLocale(uk)).toEqual({ date_format: 'DD/MM/YYYY', time_format: '12H', number_format: 'dot', week_start: 1 });
    expect(toStudioLocale(india)).toEqual({ date_format: 'DD-MM-YYYY', time_format: '24H', number_format: 'dot', week_start: 1 });
  });

  it('treats a week start of 0 as Sunday and anything else as Monday', () => {
    expect(toStudioLocale({ ...uk, week_start: 0 })?.week_start).toBe(0);
    expect(toStudioLocale({ ...uk, week_start: 5 })?.week_start).toBe(1);
  });

  it('refuses a body that is not a localization, so the browser’s own formats stay', () => {
    expect(toStudioLocale(null)).toBeNull();
    expect(toStudioLocale({})).toBeNull();
    expect(toStudioLocale('nonsense')).toBeNull();
    expect(toStudioLocale({ ...uk, date_format: 'D.M.YY' })).toBeNull();
    expect(toStudioLocale({ ...uk, time_format: '25H' })).toBeNull();
    expect(toStudioLocale({ ...uk, number_format: 'space' })).toBeNull();
  });
});

describe('with a studio localization', () => {
  const use = (body: Record<string, unknown>) => setStudioLocale(toStudioLocale(body));

  it.each([
    ['YYYY-MM-DD', '2026-11-03'],
    ['DD-MM-YYYY', '03-11-2026'],
    ['MM-DD-YYYY', '11-03-2026'],
    ['YYYY/MM/DD', '2026/11/03'],
    ['DD/MM/YYYY', '03/11/2026'],
    ['MM/DD/YYYY', '11/03/2026'],
  ])('writes a date as %s', (date_format, expected) => {
    use({ ...uk, date_format });
    expect(formatDate(afternoon)).toBe(expected);
    expect(formatDate(afternoon.toISOString())).toBe(expected);
  });

  it('writes the time in 24 or 12 hours, with noon and midnight right', () => {
    use({ ...uk, time_format: '24H' });
    expect([formatTime(afternoon), formatTime(midnight), formatTime(noon)]).toEqual(['14:07', '00:05', '12:00']);
    use({ ...uk, time_format: '12H' });
    expect([formatTime(afternoon), formatTime(midnight), formatTime(noon)]).toEqual(['2:07 PM', '12:05 AM', '12:00 PM']);
  });

  it('writes date and time together in the studio’s two formats', () => {
    use(uk);
    expect(formatDateTime(afternoon)).toBe('03/11/2026 2:07 PM');
    use(india);
    expect(formatDateTime(afternoon)).toBe('03-11-2026 14:07');
  });

  it('writes numbers with the studio’s separators', () => {
    use({ ...uk, number_format: 'dot' });
    expect(formatNumber(1234567.5)).toBe('1,234,567.5');
    use({ ...uk, number_format: 'comma' });
    expect(formatNumber(1234567.5)).toBe('1.234.567,5');
  });

  it('shows the placeholder, not "Invalid Date", for a missing or unreadable value', () => {
    use(uk);
    for (const f of [formatDate, formatTime, formatDateTime]) {
      expect(f(null)).toBe('—');
      expect(f(undefined)).toBe('—');
      expect(f('')).toBe('—');
      expect(f('not a date')).toBe('—');
      expect(f(null, '')).toBe('');
    }
  });
});

describe('without a studio localization (no default yet, a failed read, an unexpected body)', () => {
  it('keeps the browser’s own formats, exactly as before', () => {
    expect(getStudioLocale()).toBeNull();
    expect(formatDate(afternoon)).toBe(afternoon.toLocaleDateString());
    expect(formatDateTime(afternoon)).toBe(afternoon.toLocaleString());
    expect(formatTime(afternoon)).toBe(afternoon.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
    expect(formatNumber(1234567.5)).toBe((1234567.5).toLocaleString());
  });
});
