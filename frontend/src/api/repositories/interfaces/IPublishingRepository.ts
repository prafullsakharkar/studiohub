import { IRepository } from './IRepository';
import { PublishItem, PublishDestination } from '@/types/production';

export interface IPublishingRepository
  extends IRepository<PublishItem, Partial<PublishItem>, Partial<PublishItem>> {
  validatePublish(id: string): Promise<PublishItem>;
  republish(id: string, comment?: string, artistName?: string): Promise<PublishItem>;
  unpublish(id: string, reason?: string, userName?: string): Promise<PublishItem>;
  retryPublish(id: string): Promise<PublishItem>;
  getDestinations(): Promise<PublishDestination[]>;
  createDestination(data: Partial<PublishDestination>): Promise<PublishDestination>;
  getDestinationById(id: string): Promise<PublishDestination | null>;
  updateDestination(id: string, data: Partial<PublishDestination>): Promise<PublishDestination>;
  deleteDestination(id: string): Promise<void>;
}
