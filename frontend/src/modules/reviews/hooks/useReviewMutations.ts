import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '../services/ReviewService';
import { ReviewAnnotation, ReviewComment, ReviewNote, ReviewSession, ReviewParticipant } from '@/types/reviews';
import { REVIEW_QUERY_KEYS } from './useReviews';
import { SHOT_QUERY_KEYS } from '@/modules/shots/hooks/useShots';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function useReviewMutations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const invalidateAll = (reviewId?: string) => {
    queryClient.invalidateQueries({ queryKey: REVIEW_QUERY_KEYS.all });
    if (reviewId) {
      queryClient.invalidateQueries({ queryKey: REVIEW_QUERY_KEYS.detail(reviewId) });
    }
    queryClient.invalidateQueries({ queryKey: SHOT_QUERY_KEYS.all });
  };

  const createReviewMutation = useMutation({
    mutationFn: (data: Partial<ReviewSession>) => reviewService.createReview(data),
    onSuccess: (newReview) => {
      invalidateAll(newReview.id);
      addNotification({
        type: 'success',
        title: 'Review Session Created',
        message: `Created review session ${newReview.code} for ${newReview.entity_code}.`,
      });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: (reviewId: string) => reviewService.submitReview(reviewId),
    onSuccess: (updatedReview) => {
      invalidateAll(updatedReview.id);
      addNotification({
        type: 'info',
        title: 'Review Submitted',
        message: `${updatedReview.title} submitted to screening room queue.`,
      });
    },
  });

  const startReviewMutation = useMutation({
    mutationFn: (reviewId: string) => reviewService.startReview(reviewId),
    onSuccess: (updatedReview) => {
      invalidateAll(updatedReview.id);
      addNotification({
        type: 'info',
        title: 'Review Session Started',
        message: `Live screening session is now active.`,
      });
    },
  });

  const approveReviewMutation = useMutation({
    mutationFn: ({ reviewId, notes, actorName }: { reviewId: string; notes?: string; actorName?: string }) =>
      reviewService.approveReview(reviewId, notes, actorName),
    onSuccess: (updatedReview) => {
      invalidateAll(updatedReview.id);
      addNotification({
        type: 'success',
        title: 'Review Approved',
        message: `${updatedReview.title} (${updatedReview.version_number}) has been approved!`,
      });
    },
  });

  const rejectReviewMutation = useMutation({
    mutationFn: ({ reviewId, notes, actorName }: { reviewId: string; notes?: string; actorName?: string }) =>
      reviewService.rejectReview(reviewId, notes, actorName),
    onSuccess: (updatedReview) => {
      invalidateAll(updatedReview.id);
      addNotification({
        type: 'error',
        title: 'Review Rejected',
        message: `${updatedReview.title} marked for retake. Feedback dispatched to artist.`,
      });
    },
  });

  const requestChangesMutation = useMutation({
    mutationFn: ({ reviewId, notes, actorName }: { reviewId: string; notes?: string; actorName?: string }) =>
      reviewService.requestChanges(reviewId, notes, actorName),
    onSuccess: (updatedReview) => {
      invalidateAll(updatedReview.id);
      addNotification({
        type: 'warning',
        title: 'Changes Requested',
        message: `Revision notes dispatched for ${updatedReview.title}.`,
      });
    },
  });

  const closeReviewMutation = useMutation({
    mutationFn: (reviewId: string) => reviewService.closeReview(reviewId),
    onSuccess: (updatedReview) => {
      invalidateAll(updatedReview.id);
      addNotification({
        type: 'info',
        title: 'Review Closed',
        message: `${updatedReview.title} session has been concluded.`,
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ reviewId, comment }: { reviewId: string; comment: Partial<ReviewComment> }) =>
      reviewService.addComment(reviewId, comment),
    onSuccess: (_, variables) => {
      invalidateAll(variables.reviewId);
      addNotification({
        type: 'info',
        title: 'Comment Added',
        message: 'Review comment posted to timeline.',
      });
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: ({ reviewId, commentId }: { reviewId: string; commentId: string }) =>
      reviewService.resolveComment(reviewId, commentId),
    onSuccess: (_, variables) => {
      invalidateAll(variables.reviewId);
      addNotification({
        type: 'success',
        title: 'Comment Resolved',
        message: 'Comment marked as addressed.',
      });
    },
  });

  const reopenCommentMutation = useMutation({
    mutationFn: ({ reviewId, commentId }: { reviewId: string; commentId: string }) =>
      reviewService.reopenComment(reviewId, commentId),
    onSuccess: (_, variables) => {
      invalidateAll(variables.reviewId);
      addNotification({
        type: 'info',
        title: 'Comment Reopened',
        message: 'Comment status reverted to active.',
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ reviewId, note }: { reviewId: string; note: Partial<ReviewNote> }) =>
      reviewService.addNote(reviewId, note),
    onSuccess: (_, variables) => {
      invalidateAll(variables.reviewId);
      addNotification({
        type: 'info',
        title: 'Note Logged',
        message: 'Review note saved to session records.',
      });
    },
  });

  const addAnnotationMutation = useMutation({
    mutationFn: ({ reviewId, annotation }: { reviewId: string; annotation: Partial<ReviewAnnotation> }) =>
      reviewService.addAnnotation(reviewId, annotation),
    onSuccess: (_, variables) => {
      invalidateAll(variables.reviewId);
      addNotification({
        type: 'info',
        title: 'Frame Annotation Added',
        message: 'Annotation saved to review timeline.',
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
      verdict: 'Approved' | 'Retake' | 'Changes Requested' | 'Pending Review';
      notes?: string;
    }) => reviewService.submitVerdict(reviewId, verdict, notes),
    onSuccess: (updatedReview) => {
      invalidateAll(updatedReview.id);
      addNotification({
        type: updatedReview.status === 'Approved' ? 'success' : 'warning',
        title: `Review ${updatedReview.status}`,
        message: `Verdict recorded for ${updatedReview.title}.`,
      });
    },
  });

  return {
    createReview: createReviewMutation.mutateAsync,
    submitReview: submitReviewMutation.mutateAsync,
    startReview: startReviewMutation.mutateAsync,
    approveReview: approveReviewMutation.mutateAsync,
    rejectReview: rejectReviewMutation.mutateAsync,
    requestChanges: requestChangesMutation.mutateAsync,
    closeReview: closeReviewMutation.mutateAsync,
    addComment: addCommentMutation.mutateAsync,
    resolveComment: resolveCommentMutation.mutateAsync,
    reopenComment: reopenCommentMutation.mutateAsync,
    addNote: addNoteMutation.mutateAsync,
    addAnnotation: addAnnotationMutation.mutateAsync,
    submitVerdict: submitVerdictMutation.mutateAsync,
    isCreating: createReviewMutation.isPending,
    isSubmitting: submitReviewMutation.isPending,
    isStarting: startReviewMutation.isPending,
    isApproving: approveReviewMutation.isPending,
    isRejecting: rejectReviewMutation.isPending,
    isRequestingChanges: requestChangesMutation.isPending,
    isClosing: closeReviewMutation.isPending,
    isAddingComment: addCommentMutation.isPending,
    isResolvingComment: resolveCommentMutation.isPending,
    isAddingNote: addNoteMutation.isPending,
    isAddingAnnotation: addAnnotationMutation.isPending,
    isSubmittingVerdict: submitVerdictMutation.isPending,
  };
}
