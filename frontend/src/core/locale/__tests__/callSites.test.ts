import { afterEach, describe, expect, it } from 'vitest';
import { formatDay as deliveryDay, formatWhen } from '@/modules/deliveries/format';
import { formatDate as accountDate } from '@/modules/identity/components/ui';
import { formatMoment, formatRange } from '@/modules/scheduling/format';
import { setStudioLocale, toStudioLocale } from '../studioLocale';

/** The screens’ own helpers follow the studio localization once one is known, and stay as they were without one. */
const when = new Date(2026, 10, 3, 14, 7);
const iso = when.toISOString();
const studio = (over: Record<string, unknown> = {}) => setStudioLocale(toStudioLocale({ date_format: 'DD/MM/YYYY', time_format: '12H', number_format: 'dot', week_start: 1, ...over }));

afterEach(() => setStudioLocale(null));

describe('with the studio’s localization', () => {
  it('writes deliveries’ and accounts’ dates and moments in the studio’s format', () => {
    studio();
    expect(formatWhen(iso)).toBe('03/11/2026 2:07 PM');
    expect(deliveryDay(iso)).toBe('03/11/2026');
    expect(accountDate(iso)).toBe('03/11/2026 2:07 PM');
    expect(formatWhen(null)).toBe('—');
    expect(deliveryDay(undefined)).toBe('—');
  });

  it('keeps the scheduling day and month names the browser’s, and follows the studio’s clock', () => {
    studio({ time_format: '24H' });
    const day = when.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    expect(formatMoment(iso)).toBe(`${day}, 14:07`);
    studio({ time_format: '12H' });
    expect(formatMoment(iso)).toBe(`${day}, 2:07 PM`);
  });

  it('shows the end of a same-day range as a clock time in the studio’s format', () => {
    studio();
    const end = new Date(2026, 10, 3, 16, 30).toISOString();
    expect(formatRange(iso, end)).toBe(`${formatMoment(iso)} – 4:30 PM`);
  });
});

describe('without it', () => {
  it('is exactly what these helpers wrote before', () => {
    expect(formatWhen(iso)).toBe(when.toLocaleString());
    expect(deliveryDay(iso)).toBe(when.toLocaleDateString());
    expect(accountDate(iso)).toBe(when.toLocaleString());
    expect(formatMoment(iso)).toBe(when.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
    const end = new Date(2026, 10, 3, 16, 30);
    expect(formatRange(iso, end.toISOString())).toBe(`${formatMoment(iso)} – ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);
  });
});
