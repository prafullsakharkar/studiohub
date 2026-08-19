import { IOrganizationRepository } from '../repositories/IOrganizationRepository';
import { Organization } from '@/types/organization';
import { PaginatedResponse } from '@/types/drf';

export class OrganizationService {
  constructor(private readonly repo: IOrganizationRepository) {}

  async listOrganizations(params?: Record<string, any>): Promise<Organization[]> {
    return this.repo.getAll(params);
  }

  async listOrganizationsPaginated(params?: Record<string, any>): Promise<PaginatedResponse<Organization>> {
    return this.repo.getPaginated(params);
  }

  async getOrganization(id: string): Promise<Organization> {
    return this.repo.getById(id);
  }

  async createOrganization(data: Partial<Organization>): Promise<Organization> {
    // Business logic validation
    if (!data.name || !data.code) {
      throw new Error('Organization name and unique studio code are required.');
    }
    return this.repo.create(data);
  }

  async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
    return this.repo.update(id, data);
  }

  async archiveOrganization(id: string): Promise<Organization> {
    return this.repo.archive(id);
  }

  async restoreOrganization(id: string): Promise<Organization> {
    return this.repo.restore(id);
  }

  async deleteOrganization(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
