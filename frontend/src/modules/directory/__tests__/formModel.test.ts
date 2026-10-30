import { describe, expect, it } from 'vitest';
import { fromRow, fromLocalInput, toLocalInput, wireValue } from '../formModel';
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
