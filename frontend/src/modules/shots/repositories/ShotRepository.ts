import { BaseRepository } from '@/core/repository/BaseRepository';
import { IShotRepository } from './IShotRepository';
import { Shot } from '@/types/shots';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class ShotRepository
  extends BaseRepository<Shot, Partial<Shot>, Partial<Shot>>
  implements IShotRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/shots', client);
  }

  async approveShot(id: string): Promise<Shot> {
    return this.client.post<Shot>(`${this.basePath}${id}/approve/`);
  }
}

export const shotRepository = new ShotRepository();
