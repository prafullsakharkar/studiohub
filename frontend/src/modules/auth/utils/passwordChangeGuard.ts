import { User } from '@/types/identity';

export function shouldForcePasswordChange(user: Pick<User, 'must_change_password'> | null): boolean {
  return Boolean(user && user.must_change_password === true);
}
