import { PublishItem, PublishDestination } from '@/types/production';
import { RepositoryFactory } from '@/api/repositories/factory';

/**
 * PublishingService — strict single-source façade over the publishing repository.
 *
 * The active data source is decided ONLY by VITE_API_MODE via
 * RepositoryFactory (mock adapter in `mock` mode, live Django REST adapter
 * in `rest` mode). There is intentionally NO runtime fallback between modes:
 * errors propagate to the caller instead of silently serving the other
 * source's data.
 */
class PublishingService {
  private repository = RepositoryFactory.createPublishingRepository();

  async getPublishes(): Promise<PublishItem[]> {
    const res = await this.repository.findAll();
    const items = Array.isArray(res) ? res : res?.results;
    return items ?? [];
  }

  async getPublishById(id: string): Promise<PublishItem | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      if ((error as { status?: number })?.status === 404) return null;
      throw error;
    }
  }

  async getDestinations(): Promise<PublishDestination[]> {
    return this.repository.getDestinations();
  }

  async createPublish(data: Partial<PublishItem>): Promise<PublishItem> {
    return this.repository.create(data);
  }

  async validatePublish(id: string): Promise<PublishItem> {
    return this.repository.validatePublish(id);
  }

  async republish(id: string, comment: string, artistName: string): Promise<PublishItem> {
    return this.repository.republish(id, comment, artistName);
  }

  async unpublish(id: string, reason: string, userName: string): Promise<PublishItem> {
    return this.repository.unpublish(id, reason, userName);
  }

  async retryPublish(id: string): Promise<PublishItem> {
    return this.repository.retryPublish(id);
  }

  async deletePublish(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export const publishingService = new PublishingService();
