import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { evaluateFlag } from '@/api/settings/settingsFlow';
import { featureFlagsApi } from '@/api/settings/settings';
import { AuthContext } from '@/core/auth/AuthContext';

/**
 * Whether a feature flag is on for the signed-in user right now. Any signed-in user may read the flags, so this works
 * for everyone. A flag that is not defined, or that has not loaded yet, is off. The rules are in `evaluateFlag`.
 */
export function useFeatureFlag(code: string) {
  const user = useContext(AuthContext)?.user ?? null;
  const flags = useQuery({
    queryKey: [...featureFlagsApi.keys.all, 'evaluate'],
    queryFn: ({ signal }) => featureFlagsApi.list({}, signal).then((page) => page.results),
    staleTime: 60_000,
    enabled: user !== null,
  });
  const flag = flags.data?.find((f) => f.code === code);
  return { enabled: evaluateFlag(flag, String(user?.id ?? ''), new Date()), flag, isLoading: flags.isLoading, error: flags.error };
}
