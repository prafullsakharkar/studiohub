import { BaseRepository } from '@/core/repository/BaseRepository';
import { IProjectRepository } from './IProjectRepository';
import { Project } from '@/mocks/db/production/projects';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class ProjectRepository
  extends BaseRepository<Project, Partial<Project>, Partial<Project>>
  implements IProjectRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/projects', client);
  }
}

export const projectRepository = new ProjectRepository();
