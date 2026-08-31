import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { AuditLog } from '@/mocks/db/audit/auditLogs';
import { QueryParams } from '@/types/drf';
import { RawActivity } from '../api/mappers/activityMapper';

export type IAuditRepository = IBaseRepository<AuditLog, Partial<AuditLog>, Partial<AuditLog>> & {
  findActivities(params?: QueryParams): Promise<RawActivity[]>;
};
