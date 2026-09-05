import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';
import { ProductionKpis, DepartmentProgress } from '@/types/analytics';
import { Organization } from '@/types/organization';

export class DashboardService {
  private client: IApiClient;

  constructor(client: IApiClient = apiClient) {
    this.client = client;
  }

  async getKpis(): Promise<ProductionKpis> {
    return this.client.get<ProductionKpis>('/api/v1/analytics/kpis/');
  }

  async getDepartmentProgress(): Promise<DepartmentProgress[]> {
    return this.client.get<DepartmentProgress[]>('/api/v1/analytics/departments/');
  }

  async getOrganization(): Promise<Organization> {
    return this.client.get<Organization>('/api/v1/organization/');
  }
}

export const dashboardService = new DashboardService();
