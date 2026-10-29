import { useAccessActivity } from '@/modules/access/hooks/useAccessData';
import type React from 'react';
import { useState, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  Shield,
  Clock,
  User,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { SearchInput } from '@/shared/components/SearchInput';
import { Badge } from '@/shared/components/Badge';
import type { AccessAuditEvent } from '@/types/identity';
import { Modal } from '@/shared/components/Modal';

export const AccessAuditSection: React.FC = () => {
  const { accessAuditLogs } = useAccessManagementStore();
  const { data: orgActivityData } = useAccessActivity();

  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState<'ALL' | 'Role' | 'Group' | 'User' | 'Permission' | 'Project'>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<AccessAuditEvent | null>(null);

  const combinedLogs = useMemo(() => {
    const storeEvents = accessAuditLogs;

    const apiEvents: AccessAuditEvent[] = (orgActivityData?.results || []).map((e: any) => ({
      id: e.id || `act-${Date.now()}-${Math.random()}`,
      timestamp: e.timestamp || e.created_at || new Date().toISOString(),
      actorId: e.actor_id || e.actor?.id || 'usr-001',
      actorName: e.actor_name || e.actor?.name || 'Administrator',
      actorEmail: e.actor_email || e.actor?.email || 'admin@studiohub.vfx',
      action: e.action || e.description || 'access.event',
      targetType: (e.target_type || e.type || 'Permission') as any,
      targetId: e.target_id || e.id || 'target-01',
      targetName: e.target_name || e.target || 'Entity',
      organizationId: e.organization_id || '',
      details: e.details || e.metadata || {},
    }));

    const existingIds = new Set(storeEvents.map((s) => s.id));
    const uniqueApiEvents = apiEvents.filter((a) => !existingIds.has(a.id));

    return [...storeEvents, ...uniqueApiEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [accessAuditLogs, orgActivityData]);

  const filteredLogs = useMemo(() => {
    return combinedLogs.filter((log) => {
      if (targetFilter !== 'ALL' && log.targetType !== targetFilter) return false;
      if (
        search &&
        !log.action.toLowerCase().includes(search.toLowerCase()) &&
        !log.targetName.toLowerCase().includes(search.toLowerCase()) &&
        !log.actorName.toLowerCase().includes(search.toLowerCase()) &&
        !log.actorEmail.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [combinedLogs, targetFilter, search]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by actor, action, or target..."
            className="w-72 text-xs"
          />

          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="ALL">All Target Types</option>
            <option value="Role">Roles</option>
            <option value="Group">Groups</option>
            <option value="User">Users</option>
            <option value="Permission">Permissions</option>
            <option value="Project">Projects</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">
          {filteredLogs.length} Events in StudioHub
        </span>
      </div>

      {/* Events Table List */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No access audit events recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedEvent(log)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="neutral" className="font-mono text-[10px]">
                        {log.action}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{log.targetName}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {log.targetType} ({log.targetId})
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{log.actorName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{log.actorEmail}</div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[11px] text-indigo-400 font-mono hover:underline">
                        Inspect →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedEvent && (
        <Modal
          isOpen={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          title={`Audit Event Inspector: ${selectedEvent.action}`}
          subtitle={`Target: ${selectedEvent.targetType} (${selectedEvent.targetId})`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Actor</span>
                <div className="font-bold text-white mt-0.5">{selectedEvent.actorName}</div>
                <div className="text-[10px] font-mono text-slate-400">{selectedEvent.actorEmail}</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Timestamp</span>
                <div className="font-mono text-slate-200 mt-0.5">
                  {new Date(selectedEvent.timestamp).toISOString()}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Target Entity</span>
                <div className="font-bold text-white mt-0.5">{selectedEvent.targetName}</div>
                <div className="text-[10px] font-mono text-indigo-400">
                  {selectedEvent.targetType} ({selectedEvent.targetId})
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                Event Payload / Mutated Parameters
              </span>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                {JSON.stringify(selectedEvent.details, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

