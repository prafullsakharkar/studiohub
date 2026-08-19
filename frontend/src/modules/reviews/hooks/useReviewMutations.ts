import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '../services/ReviewService';
import { ReviewAnnotation } from '@/mocks/db/reviews/reviews';
import { REVIEW_QUERY_KEYS } from './useReviews';
import { SHOT_QUERY_KEYS } from '@/modules/shots/hooks/useShots';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function useReviewMutations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const addAnnotationMutation = useMutation({
    mutationFn: ({ reviewId, annotation }: { reviewId: string; annotation: Partial<ReviewAnnotation> }) =>
      reviewService.addAnnotation(reviewId, annotation),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: REVIEW_QUERY_KEYS.detail(variables.reviewId) });
      addNotification({
        type: 'info',
        title: 'Review Annotation Added',
        message: 'Frame note saved to review session timeline.',
      });
    },
  });

  const submitVerdictMutation = useMutation({
    mutationFn: ({
      reviewId,
      verdict,
      notes,
    }: {
      reviewId: string;
      verdict: 'Approved' | 'Retake' | 'Pending Review';
      notes?: string;
    }) => reviewService.submitVerdict(reviewId, verdict, notes),
    onSuccess: (updatedReview) => {
      queryClient.invalidateQueries({ queryKey: REVIEW_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
      addNotification({
        type: updatedReview.status === 'Approved' ? 'success' : 'warning',
        title: `Review ${updatedReview.status}`,
        message: `Verdict logged for ${updatedReview.title}.`,
      });
    },
  });

  return {
    addAnnotation: addAnnotationMutation.mutateAsync,
    submitVerdict: submitVerdictMutation.mutateAsync,
    isAddingAnnotation: addAnnotationMutation.isPending,
    isSubmittingVerdict: submitVerdictMutation.isPending,
  };
}
