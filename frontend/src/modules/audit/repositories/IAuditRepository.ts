import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { AuditLog } from '@/mocks/db/audit/auditLogs';

export type IAuditRepository = IBaseRepository<AuditLog, Partial<AuditLog>, Partial<AuditLog>>;
