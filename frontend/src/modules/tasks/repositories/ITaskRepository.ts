import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Task } from '@/mocks/db/tasks/tasks';

export type ITaskRepository = IBaseRepository<Task, Partial<Task>, Partial<Task>>;
