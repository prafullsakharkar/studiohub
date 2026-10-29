import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { logger } from '@/core/logging/logger';
import { ApiError } from '@/api/errors/ApiError';
import { normalizeError } from '@/api/errors/errorMapper';
import { centralErrorHandler } from '@/core/api/error-handler';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const apiError = error instanceof ApiError ? error : normalizeError(error);
      const queryKey = JSON.stringify(query.queryKey);
      logger.error('ReactQuery', `Query Error [${queryKey}] (${apiError.status} - ${apiError.type}): ${apiError.message}`);

      // Pass through central error handler with query meta options
      const meta = query.meta as { silent?: boolean; source?: string } | undefined;
      centralErrorHandler.handleError(apiError, {
        silent: meta?.silent ?? true, // Queries typically render error UI in component instead of firing toasts on every fetch
        source: `Query:${queryKey}`,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const apiError = error instanceof ApiError ? error : normalizeError(error);
      const mutationKey = mutation.options.mutationKey ? JSON.stringify(mutation.options.mutationKey) : 'Anonymous Mutation';
      logger.error('ReactQuery', `Mutation Error [${mutationKey}] (${apiError.status} - ${apiError.type}): ${apiError.message}`);

      const meta = mutation.meta as { silent?: boolean; source?: string } | undefined;
      centralErrorHandler.handleError(apiError, {
        silent: meta?.silent ?? false, // Mutations show notification toasts by default on failure
        source: `Mutation:${mutationKey}`,
      });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error) => {
        const apiError = error instanceof ApiError ? error : normalizeError(error);

        // Non-retryable errors
        if (
          apiError.status === 400 ||
          apiError.status === 401 ||
          apiError.status === 403 ||
          apiError.status === 404 ||
          apiError.status === 409 ||
          apiError.status === 422 ||
          apiError.type === 'ACCOUNT_DISABLED' ||
          apiError.type === 'ACCOUNT_LOCKED' ||
          apiError.type === 'SESSION_EXPIRED'
        ) {
          return false;
        }

        // Retryable server and network errors (max 2 retries)
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // Do not blindly retry mutations
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
  client?: QueryClient;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children, client }) => {
  useEffect(() => {
    // Clear cache when session expires or account is disabled
    const unsubAuth = centralErrorHandler.onAuthExpired(() => {
      logger.info('QueryProvider', 'Clearing QueryClient cache on session expiration');
      (client || queryClient).clear();
    });

    const unsubDisabled = centralErrorHandler.onAccountDisabled(() => {
      logger.info('QueryProvider', 'Clearing QueryClient cache on account disabled');
      (client || queryClient).clear();
    });

    return () => {
      unsubAuth();
      unsubDisabled();
    };
  }, [client]);

  return <QueryClientProvider client={client || queryClient}>{children}</QueryClientProvider>;
};
