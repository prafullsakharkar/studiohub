import { IProjectRepository, projectRepository } from '@/api/repositories';
import { Project } from '@/types/production';
import { PaginatedResponse, QueryParams } from '@/types/common';

export class ProjectService {
  private repository: IProjectRepository;

  constructor(repository: IProjectRepository = projectRepository) {
    this.repository = repository;
  }

  async getProjects(params?: QueryParams): Promise<PaginatedResponse<Project>> {
    return this.repository.findAll(params);
  }

  async getProjectById(id: string): Promise<Project> {
    return this.repository.findById(id);
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    return this.repository.create(data);
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    return this.repository.patch(id, data);
  }

  async deleteProject(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export const projectService = new ProjectService();
