import { useQuery } from '@tanstack/react-query';
import { reviewService } from '../services/ReviewService';
import { QueryParams } from '@/types/common';
import { ReviewSession } from '@/types/production';
import { useProductionContext } from '@/core/production/ProductionContext';

export const REVIEW_QUERY_KEYS = {
  all: ['reviews'] as const,
  lists: () => [...REVIEW_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...REVIEW_QUERY_KEYS.lists(), params] as const,
  details: () => [...REVIEW_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...REVIEW_QUERY_KEYS.details(), id] as const,
};

export function useReviews(params?: QueryParams) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'reviews',
      params,
    ],
    queryFn: () =>
      reviewService.getReviews({
        ...params,
        project_id: projectId || undefined,
        show_id: showId || undefined,
      }),
    enabled: Boolean(projectId && showId),
  });
}

export function useReview(id?: string) {
  const { projectId, showId } = useProductionContext();

  return useQuery<ReviewSession>({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'reviews',
      id,
    ],
    queryFn: () => {
      if (!id) throw new Error('Review ID required');
      return reviewService.getReviewById(id);
    },
    enabled: Boolean(projectId && showId && id),
  });
}
