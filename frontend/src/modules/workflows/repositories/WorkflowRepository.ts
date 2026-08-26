import { BaseRepository } from '@/core/repository/BaseRepository';
import { Workflow } from '@/types/workflow';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class WorkflowRepository extends BaseRepository<Workflow> {
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/workflows', client);
  }
}

export const workflowRepository = new WorkflowRepository();
