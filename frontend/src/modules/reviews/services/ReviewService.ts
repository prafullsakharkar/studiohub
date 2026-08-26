import { IReviewRepository } from '../repositories/IReviewRepository';
import { reviewRepository } from '../repositories/ReviewRepository';
import { ReviewSession, ReviewAnnotation, ReviewComment, ReviewNote, ReviewParticipant } from '@/types/reviews';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export class ReviewService {
  private repository: IReviewRepository;

  constructor(repository: IReviewRepository = reviewRepository) {
    this.repository = repository;
  }

  async getReviews(params?: QueryParams): Promise<PaginatedResponse<ReviewSession>> {
    return this.repository.findAll(params);
  }

  async getReviewById(id: string): Promise<ReviewSession> {
    return this.repository.findById(id);
  }

  async createReview(data: Partial<ReviewSession>): Promise<ReviewSession> {
    return this.repository.create(data);
  }

  async updateReview(id: string, data: Partial<ReviewSession>): Promise<ReviewSession> {
    return this.repository.update(id, data);
  }

  async deleteReview(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async addAnnotation(reviewId: string, annotation: Partial<ReviewAnnotation>): Promise<ReviewAnnotation> {
    return this.repository.addAnnotation(reviewId, annotation);
  }

  async submitVerdict(
    reviewId: string,
    verdict: 'Approved' | 'Retake' | 'Changes Requested' | 'Pending Review',
    notes?: string
  ): Promise<ReviewSession> {
    return this.repository.submitVerdict(reviewId, verdict, notes);
  }

  async submitReview(reviewId: string): Promise<ReviewSession> {
    return this.repository.submitReview(reviewId);
  }

  async startReview(reviewId: string): Promise<ReviewSession> {
    return this.repository.startReview(reviewId);
  }

  async approveReview(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession> {
    return this.repository.approveReview(reviewId, notes, actorName);
  }

  async rejectReview(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession> {
    return this.repository.rejectReview(reviewId, notes, actorName);
  }

  async requestChanges(reviewId: string, notes?: string, actorName?: string): Promise<ReviewSession> {
    return this.repository.requestChanges(reviewId, notes, actorName);
  }

  async closeReview(reviewId: string): Promise<ReviewSession> {
    return this.repository.closeReview(reviewId);
  }

  async addComment(reviewId: string, comment: Partial<ReviewComment>): Promise<ReviewComment> {
    return this.repository.addComment(reviewId, comment);
  }

  async resolveComment(reviewId: string, commentId: string): Promise<ReviewSession> {
    return this.repository.resolveComment(reviewId, commentId);
  }

  async reopenComment(reviewId: string, commentId: string): Promise<ReviewSession> {
    return this.repository.reopenComment(reviewId, commentId);
  }

  async addNote(reviewId: string, note: Partial<ReviewNote>): Promise<ReviewNote> {
    return this.repository.addNote(reviewId, note);
  }

  async updateParticipantVerdict(
    reviewId: string,
    participantId: string,
    verdict: ReviewParticipant['verdict'],
    notes?: string
  ): Promise<ReviewSession> {
    return this.repository.updateParticipantVerdict(reviewId, participantId, verdict, notes);
  }
}

export const reviewService = new ReviewService();
