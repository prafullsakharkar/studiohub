import { BaseRepository } from '@/core/repository/BaseRepository';
import { ITimelogRepository } from './ITimelogRepository';
import { Timelog } from '@/types/tasks';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class TimelogRepository
  extends BaseRepository<Timelog, Partial<Timelog>, Partial<Timelog>>
  implements ITimelogRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/timelogs', client);
  }
}

export const timelogRepository = new TimelogRepository();
