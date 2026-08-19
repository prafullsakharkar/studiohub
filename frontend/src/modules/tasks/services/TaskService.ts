import { ITaskRepository } from '../repositories/ITaskRepository';
import { taskRepository } from '../repositories/TaskRepository';
import { Task } from '@/mocks/db/tasks/tasks';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export class TaskService {
  private repository: ITaskRepository;

  constructor(repository: ITaskRepository = taskRepository) {
    this.repository = repository;
  }

  async getTasks(params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.repository.findAll(params);
  }

  async getTaskById(id: string): Promise<Task> {
    return this.repository.findById(id);
  }

  async createTask(data: Partial<Task>): Promise<Task> {
    return this.repository.create(data);
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    return this.repository.patch(id, data);
  }

  async deleteTask(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export const taskService = new TaskService();
