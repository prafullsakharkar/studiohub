import { IRepository } from './IRepository';
import { DeliveryPackage, DeliveryDestination } from '@/types/production';

export interface IDeliveryRepository extends IRepository<DeliveryPackage, Partial<DeliveryPackage>, Partial<DeliveryPackage>> {
  submitDelivery(id: string): Promise<DeliveryPackage>;
  prepareDelivery(id: string): Promise<DeliveryPackage>;
  approveDelivery(id: string, notes?: string): Promise<DeliveryPackage>;
  rejectDelivery(id: string, reason?: string): Promise<DeliveryPackage>;
  completeDelivery(id: string): Promise<DeliveryPackage>;
  cancelDelivery(id: string, reason?: string): Promise<DeliveryPackage>;
  validateDelivery(id: string): Promise<{ checks: any[]; passed: boolean; message: string }>;
  addVersion(id: string, versionData: any): Promise<DeliveryPackage>;
  retryDelivery(id: string): Promise<DeliveryPackage>;
  removeVersion(id: string, versionRefId: string): Promise<DeliveryPackage>;
  getDestinations(): Promise<DeliveryDestination[]>;
  createDestination(data: Partial<DeliveryDestination>): Promise<DeliveryDestination>;
}
