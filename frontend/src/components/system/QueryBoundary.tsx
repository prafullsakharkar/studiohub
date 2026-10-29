import React from 'react';
import { ApiErrorState } from './ApiErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export interface QueryBoundaryProps {
  isLoading: boolean;
  error?: unknown;
  /** True when the request succeeded but there is nothing to show. */
  isEmpty?: boolean;
  onRetry?: () => void;
  entityName?: string;
  empty?: { title: string; description: string; actionLabel?: string; onAction?: () => void; icon?: React.ReactNode };
  children: React.ReactNode;
}

/**
 * The four states every data view needs, in one place: loading, error (with the request id,
 * a retry, and a distinct "no permission" state for 403), empty, and content.
 * A refetch error with rows already on screen should keep showing the rows: pass `error` only
 * when there is nothing to show.
 */
export const QueryBoundary: React.FC<QueryBoundaryProps> = ({
  isLoading,
  error,
  isEmpty = false,
  onRetry,
  entityName,
  empty,
  children,
}) => {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }
  if (error) return <ApiErrorState error={error} onRetry={onRetry} entityName={entityName} />;
  if (isEmpty && empty) return <EmptyState {...empty} />;
  return <>{children}</>;
};
