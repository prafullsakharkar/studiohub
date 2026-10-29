import { BaseRESTAdapter } from './BaseRESTAdapter';
import { IProjectRepository } from '../../interfaces/IProjectRepository';
import { Project } from '@/types/production';

export class RESTProjectAdapter
  extends BaseRESTAdapter<Project, Partial<Project>, Partial<Project>>
  implements IProjectRepository
{
  constructor() {
    super('/api/v1/projects');
  }

  async getStatistics(projectId: string): Promise<Record<string, number>> {
    const cleanId = encodeURIComponent(projectId.trim());
    return this.request<Record<string, number>>(`${this.basePath}${cleanId}/statistics/`, {
      method: 'GET',
    });
  }
}
