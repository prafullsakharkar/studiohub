import { IRepository } from './IRepository';
import { Project } from '@/types/production';

export interface IProjectRepository extends IRepository<Project, Partial<Project>, Partial<Project>> {
  /**
   * Retrieve project-level aggregated production metrics and statistics
   */
  getStatistics(projectId: string): Promise<Record<string, number>>;
}
