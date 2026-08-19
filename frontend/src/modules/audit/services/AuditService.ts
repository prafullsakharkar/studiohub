import { IAuditRepository } from '../repositories/IAuditRepository';
import { auditRepository } from '../repositories/AuditRepository';
import { AuditLog } from '@/mocks/db/audit/auditLogs';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export class AuditService {
  private repository: IAuditRepository;

  constructor(repository: IAuditRepository = auditRepository) {
    this.repository = repository;
  }

  async getAuditLogs(params?: QueryParams): Promise<PaginatedResponse<AuditLog>> {
    return this.repository.findAll(params);
  }

  async recordLog(data: Partial<AuditLog>): Promise<AuditLog> {
    return this.repository.create(data);
  }
}

export const auditService = new AuditService();
