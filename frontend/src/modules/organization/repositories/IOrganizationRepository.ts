import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Organization } from '@/types/organization';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export interface IOrganizationRepository extends IBaseRepository<Organization> {
  getAll(params?: Record<string, any>): Promise<Organization[]>;
  getPaginated(params?: Record<string, any>): Promise<PaginatedResponse<Organization>>;
  getById(id: string): Promise<Organization>;
  archive(id: string): Promise<Organization>;
  restore(id: string): Promise<Organization>;
}
