import { IAuditRepository } from '../repositories/IAuditRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { AuditLog } from '@/types/audit';
import { PaginatedResponse, QueryParams } from '@/types/drf';
import { ActivityLogItem } from '@/types/enterprise';
import { normalizeActivities } from '../api/mappers/activityMapper';

export class AuditService {
  private repository: IAuditRepository;

  constructor(repository: IAuditRepository = auditRepository) {
    this.repository = repository;
  }

  async getAuditLogs(params?: QueryParams): Promise<PaginatedResponse<AuditLog>> {
    return this.repository.findAll(params);
  }

  async getActivities(params?: QueryParams): Promise<ActivityLogItem[]> {
    const raw = await this.repository.findActivities(params);
    return normalizeActivities(raw);
  }

  async recordLog(data: Partial<AuditLog>): Promise<AuditLog> {
    return this.repository.create(data);
  }
}

export const auditService = new AuditService();
