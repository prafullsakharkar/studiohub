import { BaseRepository } from '@/core/repository/BaseRepository';
import { IAuditRepository } from './IAuditRepository';
import { AuditLog } from '@/mocks/db/audit/auditLogs';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class AuditRepository
  extends BaseRepository<AuditLog, Partial<AuditLog>, Partial<AuditLog>>
  implements IAuditRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit', client);
  }
}

export const auditRepository = new AuditRepository();
