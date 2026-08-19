import { IOrganizationRepository } from './IOrganizationRepository';
import { Organization } from '@/types/organization';
import { PaginatedResponse, QueryParams } from '@/types/drf';
import { organizationApi } from '../api/organizationApi';

export class OrganizationRepository implements IOrganizationRepository {
  async findAll(params?: QueryParams): Promise<PaginatedResponse<Organization>> {
    return organizationApi.getOrganizationsPaginated(params as any);
  }

  async findById(id: string): Promise<Organization> {
    return organizationApi.getOrganizationDetail(id);
  }

  async getAll(params?: Record<string, any>): Promise<Organization[]> {
    return organizationApi.getOrganizations(params);
  }

  async getPaginated(params?: Record<string, any>): Promise<PaginatedResponse<Organization>> {
    return organizationApi.getOrganizationsPaginated(params);
  }

  async getById(id: string): Promise<Organization> {
    return organizationApi.getOrganizationDetail(id);
  }

  async create(data: Partial<Organization>): Promise<Organization> {
    return organizationApi.createOrganization(data);
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    return organizationApi.updateOrganization(id, data);
  }

  async patch(id: string, data: Partial<Organization>): Promise<Organization> {
    return organizationApi.updateOrganization(id, data);
  }

  async archive(id: string): Promise<Organization> {
    return organizationApi.archiveOrganization(id);
  }

  async restore(id: string): Promise<Organization> {
    return organizationApi.restoreOrganization(id);
  }

  async delete(id: string): Promise<void> {
    return organizationApi.deleteOrganization(id);
  }
}

export const organizationRepository = new OrganizationRepository();
