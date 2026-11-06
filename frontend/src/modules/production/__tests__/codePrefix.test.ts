import { describe, expect, it } from 'vitest';
import { projectCodePrefix, withProjectPrefix } from '../codePrefix';

describe('the project code in front of a new code', () => {
  it('adds PROJECT_ in front, upper case', () => {
    expect(projectCodePrefix('tst')).toBe('TST_');
    expect(withProjectPrefix('TST', 'sq0010')).toBe('TST_SQ0010');
    expect(withProjectPrefix(' tst ', ' SQ0010 ')).toBe('TST_SQ0010');
  });

  it('keeps a code that already starts with it, so a second pass changes nothing', () => {
    expect(withProjectPrefix('TST', 'TST_SQ0010')).toBe('TST_SQ0010');
    expect(withProjectPrefix('TST', withProjectPrefix('TST', 'SQ0010'))).toBe('TST_SQ0010');
    expect(withProjectPrefix('TST', 'tst_sq0010')).toBe('TST_SQ0010');
  });

  it('only a full "TST_" counts: a code that merely begins with the letters is prefixed', () => {
    expect(withProjectPrefix('TST', 'TSTX010')).toBe('TST_TSTX010');
  });

  it('leaves an empty code empty (the server numbers it) and adds nothing without a project', () => {
    expect(withProjectPrefix('TST', '')).toBe('');
    expect(withProjectPrefix('TST', undefined)).toBe('');
    expect(withProjectPrefix(undefined, 'SQ0010')).toBe('SQ0010');
    expect(projectCodePrefix('')).toBe('');
  });
});
