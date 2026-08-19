import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { ReviewSession, ReviewAnnotation } from '@/mocks/db/reviews/reviews';

export interface IReviewRepository extends IBaseRepository<ReviewSession, Partial<ReviewSession>, Partial<ReviewSession>> {
  addAnnotation(reviewId: string, annotation: Partial<ReviewAnnotation>): Promise<ReviewAnnotation>;
  submitVerdict(reviewId: string, verdict: 'Approved' | 'Retake' | 'Pending Review', notes?: string): Promise<ReviewSession>;
}
