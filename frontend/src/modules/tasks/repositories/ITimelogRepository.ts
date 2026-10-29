import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Timelog } from '@/types/production';

export type ITimelogRepository = IBaseRepository<Timelog, Partial<Timelog>, Partial<Timelog>>;
