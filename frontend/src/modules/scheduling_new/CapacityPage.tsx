import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { serverMessage } from '@/api/errors/serverMessage';
import { capacityApi } from '@/api/scheduling/scheduling';
import type { OverbookingAlert } from '@/api/scheduling/scheduling';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { formatDay, formatHours } from './format';

/**
 * This week, studio-wide: capacity per department and the resources booked beyond their weekly capacity.
 * "Flag" marks the week's bookings Overbooked; the alert stays until the hours are fixed (the server only flags).
 */
export const CapacityPage: React.FC = () => {
  const canResolve = useCan('schedule.update');
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const summary = useQuery({ queryKey: capacityApi.keys.all, queryFn: ({ signal }) => capacityApi.summary(signal) });
  const alerts = useQuery({ queryKey: capacityApi.keys.overbooking, queryFn: ({ signal }) => capacityApi.overbooking(signal) });
  const resolve = useMutation({
    mutationFn: (alert: OverbookingAlert) => capacityApi.resolve(alert.id, alert.resource_id),
    onSuccess: async (result) => {
      setError(null);
      notify.success(result.message);
      await Promise.all([queryClient.invalidateQueries({ queryKey: capacityApi.keys.all }), queryClient.invalidateQueries({ queryKey: capacityApi.keys.overbooking })]);
    },
    onError: (e) => setError(serverMessage(e)),
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Capacity</h1>
        <p className="text-xs text-slate-400">The current week, Monday to Sunday in each resource’s calendar. Approved leave and holidays lower a resource’s capacity.</p>
      </div>

      <QueryBoundary isLoading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()} entityName="capacity">
        <section aria-label="Capacity by department" className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                {['Department', 'Resources', 'Capacity', 'Booked', 'Free', 'Utilization', 'Overbooked'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(summary.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No resources yet.
                  </td>
                </tr>
              )}
              {(summary.data ?? []).map((row) => (
                <tr key={row.department} className="border-t border-slate-800 text-slate-200">
                  <td className="px-4 py-2">{row.department}</td>
                  <td className="px-4 py-2">{row.total_resources}</td>
                  <td className="px-4 py-2">{formatHours(row.total_capacity_hours)}</td>
                  <td className="px-4 py-2">{formatHours(row.allocated_hours)}</td>
                  <td className="px-4 py-2">{formatHours(row.free_hours)}</td>
                  <td className="px-4 py-2">{row.utilization_pct}%</td>
                  <td className="px-4 py-2">{row.overbooked_count > 0 ? <Badge variant="destructive">{row.overbooked_count}</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </QueryBoundary>

      <section aria-label="Overbooking alerts" className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Overbooked this week</h2>
        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">
            {error}
          </p>
        )}
        <QueryBoundary isLoading={alerts.isLoading} error={alerts.error} onRetry={() => void alerts.refetch()} entityName="overbooking alerts">
          {(alerts.data ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">Nobody is booked beyond their capacity this week.</p>
          ) : (
            <ul className="space-y-3">
              {(alerts.data ?? []).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {alert.resource_name} <span className="text-xs font-normal text-slate-400">· {alert.resource_type}</span>
                      </p>
                      <p className="text-xs text-slate-300">
                        {formatHours(alert.scheduled_hours)} booked of {formatHours(alert.max_capacity_hours)}: <strong className="text-rose-300">{formatHours(alert.excess_hours)} over</strong>, week of {formatDay(alert.date)}.
                      </p>
                      <p className="text-xs text-slate-500">{alert.suggested_resolution}</p>
                    </div>
                    {canResolve && (
                      <Button size="sm" variant="outline" isLoading={resolve.isPending && resolve.variables?.id === alert.id} onClick={() => resolve.mutate(alert)}>
                        Flag bookings as overbooked
                      </Button>
                    )}
                  </div>
                  <ul className="text-xs text-slate-400 list-disc pl-5">
                    {alert.conflicting_events.map((event) => (
                      <li key={event.id}>
                        {event.title}
                        {event.project_code ? ` (${event.project_code})` : ''}: {formatHours(event.hours)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </section>
    </div>
  );
};
