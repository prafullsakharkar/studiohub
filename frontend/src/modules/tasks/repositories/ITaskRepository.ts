import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Task } from '@/types/tasks';

export type ITaskRepository = IBaseRepository<Task, Partial<Task>, Partial<Task>>;
