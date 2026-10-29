import { DemoUser } from '@/types/identity';

export const DEMO_USERS_QUERY_KEY = ['auth', 'demo-users'] as const;

// REST-only: there is no backend demo-users endpoint, so this hook always
// resolves to an empty list and never fires a network request.
export function useDemoUsers() {
  return { data: [] as DemoUser[], isLoading: false };
}
