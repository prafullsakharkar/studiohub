import { useQuery } from '@tanstack/react-query';
import { changeLogService } from '@/modules/audit/services/auditServices';
import { ChangeLog } from '@/types/audit';

/**
 * Entity-scoped change log feed (backend-audited History).
 *
 * Powers the Activity/History tabs on edit workspaces. Rows are produced by
 * the backend ChangeLog writer at DB-write time — a failed save cannot
 * produce a log entry (no optimistic frontend writes).
 */
export function useEntityChangeLog(targetType: string, targetId: string | undefined) {
  return useQuery({
    queryKey: ['change-logs', 'entity', targetType, targetId],
    queryFn: () =>
      changeLogService.getChangeLogs({
        target_type: targetType,
        target_id: targetId,
        page_size: 50,
      }),
    enabled: Boolean(targetType && targetId),
  });
}

export type EntityChangeLogItem = ChangeLog;

export interface ActivityRow {
  id: string;
  action: string;
  user_name: string;
  description: string;
  timestamp: string;
  changed_fields: string[];
  category: string;
}

/**
 * Map a backend ChangeLog row onto the flat shape the activity tabs render.
 */
export function toActivityRow(log: ChangeLog): ActivityRow {
  const fields = log.changed_fields ?? [];
  const changed = fields.length ? `: ${fields.join(", ")}` : "";
  const name = log.target_name || log.target_id || "record";
  return {
    id: log.id,
    action: `${log.change_type} ${log.target_type ?? "Record"}${changed}`.trim(),
    user_name: log.user_name || log.user_email || "System",
    description:
      log.description ||
      `${log.change_type} ${name}`.trim(),
    timestamp: log.created_at ?? "",
    changed_fields: fields,
    category: log.change_type?.toUpperCase() ?? "UPDATE",
  };
}
