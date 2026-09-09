import { BaseRepository } from '@/core/repository/BaseRepository';
import { IReviewRepository } from './IReviewRepository';
import { ReviewSession, ReviewAnnotation, ReviewComment, ReviewNote, ReviewParticipant } from '@/types/reviews';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class ReviewRepository
  extends BaseRepository<ReviewSession, Partial<ReviewSession>, Partial<ReviewSession>>
  implements IReviewRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/reviews/', client);
  }

  async addAnnotation(reviewId: string, annotation: Partial<ReviewAnnotation>): Promise<ReviewAnnotation> {
    return this.client.post<ReviewAnnotation>(`${this.basePath}${reviewId}/annotations/`, annotation);
  }

  async submitVerdict(
    reviewId: string,
    verdict: 'Approved' | 'Retake' | 'Changes Requested' | 'Pending Review',
    notes?: string
  ): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/verdict/`, { verdict, notes });
  }

  async submitReview(reviewId: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/submit/`, {});
  }

  async startReview(reviewId: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/start-review/`, {});
  }

  async approveReview(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/approve/`, { notes, actor_name: actorName });
  }

  async rejectReview(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/reject/`, { notes, actor_name: actorName });
  }

  async requestChanges(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/request-changes/`, { notes, actor_name: actorName });
  }

  async closeReview(reviewId: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/close/`, {});
  }

  async addComment(reviewId: string, comment: Partial<ReviewComment>): Promise<ReviewComment> {
    return this.client.post<ReviewComment>(`${this.basePath}${reviewId}/comments/`, comment);
  }

  async resolveComment(reviewId: string, commentId: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/comments/${commentId}/resolve/`, {});
  }

  async reopenComment(reviewId: string, commentId: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/comments/${commentId}/reopen/`, {});
  }

  async addNote(reviewId: string, note: Partial<ReviewNote>): Promise<ReviewNote> {
    return this.client.post<ReviewNote>(`${this.basePath}${reviewId}/notes/`, note);
  }

  async updateParticipantVerdict(
    reviewId: string,
    participantId: string,
    verdict: ReviewParticipant['verdict'],
    notes?: string
  ): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/participant-verdict/`, {
      participant_id: participantId,
      verdict,
      notes,
    });
  }
}

export const reviewRepository = new ReviewRepository();
