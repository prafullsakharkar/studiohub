import { describe, expect, it } from 'vitest';
import { buildSchema, fromRow, fromLocalInput, joinIds, splitIds, toLocalInput, wireValue } from '../formModel';
import type { FieldDef } from '../types';

const when: FieldDef = { kind: 'datetime', name: 'start_time', label: 'Starts', required: true };

describe('datetime fields (the scheduling API refuses a date-time without a zone)', () => {
  it('goes out as a UTC instant with a Z, whatever the browser zone', () => {
    const sent = String(wireValue(when, '2026-11-04T10:00'));
    expect(sent).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // the local reading of what was sent is what was typed
    expect(toLocalInput(sent)).toBe('2026-11-04T10:00');
  });
  it('a stored instant is shown in the browser zone and sent back unchanged', () => {
    const shown = toLocalInput('2026-11-04T10:00:00Z');
    expect(shown).toMatch(/^2026-11-0[34]T|^2026-11-04T/);
    expect(fromLocalInput(shown)).toBe('2026-11-04T10:00:00.000Z');
  });
  it('fromRow reads the row key and a blank sends null', () => {
    expect(fromRow([when], { start_time: '2026-11-04T10:00:00Z' }).start_time).toBe(toLocalInput('2026-11-04T10:00:00Z'));
    expect(fromRow([when], { start_time: null }).start_time).toBe('');
    expect(wireValue(when, '')).toBeNull();
  });
  it('something that is not a date is left alone for the server to refuse', () => {
    expect(fromLocalInput('soon')).toBe('soon');
    expect(toLocalInput('soon')).toBe('');
  });
});

describe('multi-entity fields (a list of ids, e.g. a project’s vendors, CR-42)', () => {
  const vendors: FieldDef = { kind: 'multi-entity', name: 'vendor_ids', label: 'Vendors', render: () => null };
  const ids = ['611eec15-0855-4da2-ad73-a4817e1d4de4', 'c41baaf8-21a6-492d-a9b4-0a46fd2ac8a3'];

  it('a saved list is held as one text, in order, and goes out as the same list', () => {
    const held = fromRow([vendors], { vendor_ids: ids }).vendor_ids;
    expect(held).toBe(ids.join(','));
    expect(splitIds(held)).toEqual(ids);
    expect(wireValue(vendors, held)).toEqual(ids);
  });
  it('an empty list sends [] (clears it), never [""] or null', () => {
    expect(fromRow([vendors], { vendor_ids: [] }).vendor_ids).toBe('');
    expect(fromRow([vendors], { vendor_ids: null }).vendor_ids).toBe('');
    expect(wireValue(vendors, '')).toEqual([]);
    expect(joinIds([])).toBe('');
  });
  it('a required one asks to choose', () => {
    const result = buildSchema([{ ...vendors, required: true }]).safeParse({ vendor_ids: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Choose vendors.');
  });
});
