import { BaseRepository } from '@/core/repository/BaseRepository';
import { ITaskRepository } from './ITaskRepository';
import { Task } from '@/mocks/db/tasks/tasks';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class TaskRepository
  extends BaseRepository<Task, Partial<Task>, Partial<Task>>
  implements ITaskRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/tasks', client);
  }
}

export const taskRepository = new TaskRepository();
