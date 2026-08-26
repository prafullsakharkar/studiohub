import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Timelog } from '@/types/tasks';

export type ITimelogRepository = IBaseRepository<Timelog, Partial<Timelog>, Partial<Timelog>>;
