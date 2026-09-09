import { BaseRepository } from '@/core/repository/BaseRepository';
import { IAuditRepository } from './IAuditRepository';
import { AuditLog } from '@/types/audit';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';
import { RawActivity } from '../api/mappers/activityMapper';
import { QueryParams } from '@/types/drf';

export class AuditRepository
  extends BaseRepository<AuditLog, Partial<AuditLog>, Partial<AuditLog>>
  implements IAuditRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit', client);
  }

  async findActivities(params?: QueryParams): Promise<RawActivity[]> {
    return this.client.get<RawActivity[]>(`${this.basePath}activities/`, { params });
  }
}

export const auditRepository = new AuditRepository();
