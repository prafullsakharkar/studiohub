import { IReviewRepository } from '../repositories/IReviewRepository';
import { reviewRepository } from '../repositories/ReviewRepository';
import { ReviewSession, ReviewAnnotation } from '@/mocks/db/reviews/reviews';
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

  async addAnnotation(reviewId: string, annotation: Partial<ReviewAnnotation>): Promise<ReviewAnnotation> {
    return this.repository.addAnnotation(reviewId, annotation);
  }

  async submitVerdict(
    reviewId: string,
    verdict: 'Approved' | 'Retake' | 'Pending Review',
    notes?: string
  ): Promise<ReviewSession> {
    return this.repository.submitVerdict(reviewId, verdict, notes);
  }
}

export const reviewService = new ReviewService();
