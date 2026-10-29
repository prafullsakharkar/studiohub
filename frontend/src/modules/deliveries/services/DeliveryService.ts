import { RepositoryFactory } from '@/api/repositories/factory';
import {
  DeliveryPackage,
  DeliveryDestination,
  DeliveryVersionRef,
} from '@/types/production';

/**
 * DeliveryService — strict single-source façade over the delivery repository.
 *
 * The active data source is decided ONLY by VITE_API_MODE via
 * RepositoryFactory (mock adapter in `mock` mode, live Django REST adapter
 * in `rest` mode). There is intentionally NO runtime fallback between modes:
 * errors propagate to the caller instead of silently serving the other
 * source's data.
 */
class DeliveryService {
  private repository = RepositoryFactory.createDeliveryRepository();

  private static isNotFound(error: unknown): boolean {
    return (error as { status?: number })?.status === 404;
  }

  async getDeliveries(): Promise<DeliveryPackage[]> {
    const res = await this.repository.findAll();
    const items = Array.isArray(res) ? res : res?.results;
    return items ?? [];
  }

  async getDeliveryById(id: string): Promise<DeliveryPackage | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      if (DeliveryService.isNotFound(error)) return null;
      throw error;
    }
  }

  async getDestinations(): Promise<DeliveryDestination[]> {
    return this.repository.getDestinations();
  }

  async createDelivery(data: Partial<DeliveryPackage>): Promise<DeliveryPackage> {
    return this.repository.create(data);
  }

  // Actor names are accepted for hook compatibility but ignored: the active
  // backend (mock adapter or Django) resolves the actor from the session.
  async prepareDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    return this.repository.prepareDelivery(id);
  }

  async validateDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    // Perform server-side validation, then return the refreshed package so
    // callers keep the established `Promise<DeliveryPackage>` contract.
    await this.repository.validateDelivery(id);
    return this.repository.findById(id);
  }

  async submitDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    return this.repository.submitDelivery(id);
  }

  async approveDelivery(id: string, _actorName?: string, notes?: string): Promise<DeliveryPackage> {
    return this.repository.approveDelivery(id, notes);
  }

  async rejectDelivery(id: string, reason: string, _notes?: string, _actorName?: string): Promise<DeliveryPackage> {
    return this.repository.rejectDelivery(id, reason);
  }

  async retryDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    return this.repository.retryDelivery(id);
  }

  async completeDelivery(id: string, _actorName?: string): Promise<DeliveryPackage> {
    return this.repository.completeDelivery(id);
  }

  async cancelDelivery(id: string, reason: string, _actorName?: string): Promise<DeliveryPackage> {
    return this.repository.cancelDelivery(id, reason);
  }

  async addVersionToDelivery(id: string, version: DeliveryVersionRef): Promise<DeliveryPackage> {
    return this.repository.addVersion(id, version);
  }

  async removeVersionFromDelivery(id: string, versionId: string): Promise<DeliveryPackage> {
    return this.repository.removeVersion(id, versionId);
  }
}

export const deliveryService = new DeliveryService();
