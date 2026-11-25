import { describe, expect, it } from 'vitest';
import { STUDIO_CODE_PREFIX, withCodePrefix } from '../codePrefix';

describe('a fixed prefix in front of a new code', () => {
  it('adds it in front, upper case', () => {
    expect(withCodePrefix('DEPT-', 'lgt')).toBe('DEPT-LGT');
    expect(withCodePrefix('DEPT-', ' LGT ')).toBe('DEPT-LGT');
    expect(withCodePrefix('dept-', 'LGT')).toBe('DEPT-LGT');
  });

  it('keeps a code that already starts with it, so a second pass changes nothing', () => {
    expect(withCodePrefix('DEPT-', 'dept-lgt')).toBe('DEPT-LGT');
    expect(withCodePrefix('DEPT-', withCodePrefix('DEPT-', 'LGT'))).toBe('DEPT-LGT');
  });

  it('only the full prefix counts: a code that merely begins with the letters is prefixed', () => {
    expect(withCodePrefix('DEPT-', 'DEPTH')).toBe('DEPT-DEPTH');
  });

  it('leaves an empty code empty and adds nothing without a prefix', () => {
    expect(withCodePrefix('DEPT-', '')).toBe('');
    expect(withCodePrefix('DEPT-', undefined)).toBe('');
    expect(withCodePrefix('', 'LGT')).toBe('LGT');
  });

  it('names the prefixes the seeded studio records use', () => {
    expect(STUDIO_CODE_PREFIX).toEqual({ department: 'DEPT-', team: 'TEAM-', position: 'POS-', office: 'OFF-', client: 'CLI-', vendor: 'VEN-' });
  });
});
