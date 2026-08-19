import { useQuery } from '@tanstack/react-query';
import { reviewService } from '../services/ReviewService';
import { QueryParams } from '@/types/drf';

export const REVIEW_QUERY_KEYS = {
  all: ['reviews'] as const,
  lists: () => [...REVIEW_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...REVIEW_QUERY_KEYS.lists(), params] as const,
  details: () => [...REVIEW_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...REVIEW_QUERY_KEYS.details(), id] as const,
};

export function useReviews(params?: QueryParams) {
  return useQuery({
    queryKey: REVIEW_QUERY_KEYS.list(params),
    queryFn: () => reviewService.getReviews(params),
  });
}

export function useReview(id?: string) {
  return useQuery({
    queryKey: id ? REVIEW_QUERY_KEYS.detail(id) : ['reviews', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Review ID required');
      return reviewService.getReviewById(id);
    },
    enabled: !!id,
  });
}
