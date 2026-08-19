import { BaseRepository } from '@/core/repository/BaseRepository';
import { IReviewRepository } from './IReviewRepository';
import { ReviewSession, ReviewAnnotation } from '@/mocks/db/reviews/reviews';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class ReviewRepository
  extends BaseRepository<ReviewSession, Partial<ReviewSession>, Partial<ReviewSession>>
  implements IReviewRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/reviews', client);
  }

  async addAnnotation(reviewId: string, annotation: Partial<ReviewAnnotation>): Promise<ReviewAnnotation> {
    return this.client.post<ReviewAnnotation>(`${this.basePath}${reviewId}/annotations/`, annotation);
  }

  async submitVerdict(reviewId: string, verdict: 'Approved' | 'Retake' | 'Pending Review', notes?: string): Promise<ReviewSession> {
    return this.client.post<ReviewSession>(`${this.basePath}${reviewId}/verdict/`, { verdict, notes });
  }
}

export const reviewRepository = new ReviewRepository();
