import type { ResourceRow } from '@/api/scheduling/scheduling';

/** The booking statuses that use up a resource's hours: a Blocked slot is time off the table, an Available one is free time. */
export const ALLOCATING = new Set(['Booked', 'Overbooked']);

export type Band = 'over' | 'optimal' | 'under';
export const BANDS: ReadonlyArray<{ band: Band; label: string; hint: string }> = [
  { band: 'over', label: 'Over capacity', hint: 'booked for more than the resource can work in the week' },
  { band: 'optimal', label: 'Well used', hint: '70 to 100% of the weekly capacity' },
  { band: 'under', label: 'Under-used', hint: 'under 70% of the weekly capacity' },
];

export const bandOf = (percent: number): Band => (percent > 100 ? 'over' : percent >= 70 ? 'optimal' : 'under');

interface Slot {
  resource: string;
  start_time: string;
  end_time: string;
  status: string;
}

/** The hours of `slot` that fall inside the window (a slot across the window's edge counts only for the part inside). */
export function hoursInWindow(slot: Pick<Slot, 'start_time' | 'end_time'>, windowStart: Date, windowEnd: Date): number {
  const start = Math.max(new Date(slot.start_time).getTime(), windowStart.getTime());
  const end = Math.min(new Date(slot.end_time).getTime(), windowEnd.getTime());
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 3_600_000 : 0;
}

export interface UtilizationRow {
  resource: ResourceRow;
  booked: number;
  capacity: number;
  percent: number;
  band: Band;
}

/** Booked hours against the weekly capacity for each resource that has any; a resource with no capacity cannot be measured and is left out. */
export function utilizationOf(resources: ResourceRow[], slots: Slot[], windowStart: Date, windowEnd: Date): UtilizationRow[] {
  const booked = new Map<string, number>();
  for (const slot of slots) {
    if (!ALLOCATING.has(slot.status)) continue;
    booked.set(slot.resource, (booked.get(slot.resource) ?? 0) + hoursInWindow(slot, windowStart, windowEnd));
  }
  return resources
    .filter((r) => r.capacity_hours_per_week > 0)
    .map((resource) => {
      const hours = Math.round((booked.get(resource.id) ?? 0) * 10) / 10;
      const percent = Math.round((hours / resource.capacity_hours_per_week) * 100);
      return { resource, booked: hours, capacity: resource.capacity_hours_per_week, percent, band: bandOf(percent) };
    })
    .sort((a, b) => b.percent - a.percent || a.resource.name.localeCompare(b.resource.name));
}
