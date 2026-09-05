import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Project } from '@/types/projects';

export interface IProjectRepository extends IBaseRepository<Project, Partial<Project>, Partial<Project>> {
  getStatistics?(projectId: string): Promise<Record<string, number>>;
}
