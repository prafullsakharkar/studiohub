import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { bookingsApi, EVENT_STATUSES, eventsApi } from '@/api/scheduling/scheduling';
import { EntityHistory } from '@/components/history/EntityHistory';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { fetchAllRows } from '@/shared/data/listing';
import { safeWebUrl } from '@/shared/utils/safeUrl';
import { formatDay, formatRange } from './format';

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-xs text-slate-200">{children || '—'}</dd>
  </div>
);

/** One event: when and where, what it belongs to, who is booked on it (the crew), and the status moves the caller may make. */
export const EventWorkspace: React.FC = () => {
  const { eventId = '' } = useParams();
  const queryClient = useQueryClient();
  const canUpdate = useCan('schedule.update');
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: eventsApi.keys.detail(eventId), queryFn: ({ signal }) => eventsApi.get(eventId, signal), enabled: Boolean(eventId) });
  const crew = useQuery({ queryKey: [...bookingsApi.keys.lists(), 'of-event', eventId], queryFn: ({ signal }) => fetchAllRows(bookingsApi.list, { event: eventId }, { signal }), enabled: Boolean(eventId) });
  const event = query.data;
  const meeting = safeWebUrl(event?.meeting_url);

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      await eventsApi.updateStatus(eventId, status);
      await Promise.all([eventsApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    } catch (error) {
      notify.error(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="event">
        {event && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/scheduling/events" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Events
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">{event.title}</h1>
                <p className="mt-1 text-xs text-slate-400">{[event.event_type_display, event.visibility_display].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <StatusBadge status={event.status} />
                <div role="toolbar" aria-label="Event actions" className="flex flex-wrap gap-2">
                  {canUpdate &&
                    EVENT_STATUSES.filter((s) => s !== event.status).map((s) => (
                      <Button key={s} size="sm" variant="outline" disabled={busy} onClick={() => void setStatus(s)}>
                        {`Mark ${s}`}
                      </Button>
                    ))}
                  {canUpdate && (
                    <Link to={`/scheduling/events/${event.id}/edit`}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <dl aria-label="Event details" className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="When">{event.is_all_day ? `${formatDay(event.start_time)} (all day)` : formatRange(event.start_time, event.end_time)}</Fact>
              <Fact label="Where">{event.location}</Fact>
              <Fact label="Project">
                {event.project ? (
                  <Link to={`/projects/${event.project}`} className="text-cyan-300 hover:underline">
                    {event.project_name || 'Project'}
                  </Link>
                ) : (
                  ''
                )}
              </Fact>
              <Fact label="Meeting link">
                {meeting ? (
                  <a href={meeting} target="_blank" rel="noreferrer noopener" className="text-cyan-300 hover:underline">
                    Join
                  </a>
                ) : (
                  ''
                )}
              </Fact>
            </dl>
            {event.description && (
              <section aria-label="Description" className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-200">Description</h2>
                <p className="whitespace-pre-wrap text-xs text-slate-300">{event.description}</p>
              </section>
            )}
            {event.notes && (
              <section aria-label="Notes" className="space-y-1">
                <h2 className="text-sm font-semibold text-slate-200">Notes</h2>
                <p className="whitespace-pre-wrap text-xs text-slate-300">{event.notes}</p>
              </section>
            )}

            <section aria-label="Crew" className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-200">Crew</h2>
              {crew.isLoading ? (
                <p className="text-xs text-slate-500">Loading…</p>
              ) : (crew.data ?? []).length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">Nobody is booked on this event.</p>
              ) : (
                <ul aria-label="Booked on this event" className="space-y-1.5">
                  {(crew.data ?? []).map((b) => (
                    <li key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                      <Link to={`/scheduling/resources/${b.resource}`} className="font-semibold text-cyan-300 hover:underline">
                        {b.resource_name}
                      </Link>
                      <span className="font-mono text-[11px] text-slate-400">{formatRange(b.start_time, b.end_time)}</span>
                      <StatusBadge status={b.status} size="xs" />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <EntityHistory targetType="CalendarEvent" targetId={event.id} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
