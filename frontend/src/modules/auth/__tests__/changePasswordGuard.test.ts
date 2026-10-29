import { describe, expect, it } from 'vitest';
import { shouldForcePasswordChange } from '../utils/passwordChangeGuard';
import { User } from '@/types/identity';

describe('shouldForcePasswordChange', () => {
  it('forces change when the flag is set', () => {
    expect(shouldForcePasswordChange({ must_change_password: true } as Partial<User>)).toBe(true);
  });

  it('does not force change when the flag is absent or false', () => {
    expect(shouldForcePasswordChange({} as Partial<User>)).toBe(false);
    expect(shouldForcePasswordChange({ must_change_password: false } as Partial<User>)).toBe(false);
  });
});
