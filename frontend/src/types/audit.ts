import { BaseEntity } from '@/types/common';

export interface AuditLog extends BaseEntity {
  user_id: string;
  user_name: string;
  user_email: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'PUBLISH' | 'LOGIN' | 'EXPORT';
  entity_type: 'Project' | 'Shot' | 'Asset' | 'Task' | 'Review' | 'User' | 'Pipeline';
  entity_id: string;
  entity_code: string;
  description: string;
  ip_address: string;
  changes_diff?: Record<string, { old: any; new: any }>;
}
