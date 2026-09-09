import React from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { logger } from '@/core/logging/logger';
import { ApiError } from '@/api/errors/ApiError';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const queryKey = JSON.stringify(query.queryKey);
      if (error instanceof ApiError) {
        logger.error('ReactQuery', `Query Error [${queryKey}] (${error.status}): ${error.message}`, error);
      } else {
        logger.error('ReactQuery', `Query Error [${queryKey}]`, error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const mutationKey = mutation.options.mutationKey ? JSON.stringify(mutation.options.mutationKey) : 'Anonymous Mutation';
      logger.error('ReactQuery', `Mutation Error [${mutationKey}]`, error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
