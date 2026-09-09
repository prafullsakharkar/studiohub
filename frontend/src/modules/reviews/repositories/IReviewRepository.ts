import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { ReviewSession, ReviewAnnotation, ReviewComment, ReviewNote, ReviewParticipant } from '@/types/reviews';

export interface IReviewRepository extends IBaseRepository<ReviewSession, Partial<ReviewSession>, Partial<ReviewSession>> {
  addAnnotation(reviewId: string, annotation: Partial<ReviewAnnotation>): Promise<ReviewAnnotation>;
  submitVerdict(reviewId: string, verdict: 'Approved' | 'Retake' | 'Changes Requested' | 'Pending Review', notes?: string): Promise<ReviewSession>;
  submitReview(reviewId: string): Promise<ReviewSession>;
  startReview(reviewId: string): Promise<ReviewSession>;
  approveReview(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession>;
  rejectReview(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession>;
  requestChanges(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession>;
  closeReview(reviewId: string): Promise<ReviewSession>;
  addComment(reviewId: string, comment: Partial<ReviewComment>): Promise<ReviewComment>;
  resolveComment(reviewId: string, commentId: string): Promise<ReviewSession>;
  reopenComment(reviewId: string, commentId: string): Promise<ReviewSession>;
  addNote(reviewId: string, note: Partial<ReviewNote>): Promise<ReviewNote>;
  updateParticipantVerdict(reviewId: string, participantId: string, verdict: ReviewParticipant['verdict'], notes?: string): Promise<ReviewSession>;
}
