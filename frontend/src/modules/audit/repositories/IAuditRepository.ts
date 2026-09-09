import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { AuditLog } from '@/types/audit';
import { QueryParams } from '@/types/drf';
import { RawActivity } from '../api/mappers/activityMapper';

export type IAuditRepository = IBaseRepository<AuditLog, Partial<AuditLog>, Partial<AuditLog>> & {
  findActivities(params?: QueryParams): Promise<RawActivity[]>;
};
