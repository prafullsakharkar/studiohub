import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { resourcesApi } from '@/api/scheduling/scheduling';
import type { Resource } from '@/api/scheduling/scheduling';
import { EntityHistory } from '@/components/history/EntityHistory';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { useBookingsListConfig, useLeavesListConfig, resourceStatusVariant } from './records';
import { formatHours, formatRate } from './format';

type TabId = 'details' | 'bookings' | 'leave' | 'changes';
const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'leave', label: 'Leave' },
  { id: 'changes', label: 'Changes' },
];

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 py-2 border-t border-slate-800 first:border-t-0">
    <dt className="w-44 shrink-0 text-xs text-slate-500">{label}</dt>
    <dd className="text-xs text-slate-200">{children}</dd>
  </div>
);

const DetailsPanel: React.FC<{ resource: Resource }> = ({ resource }) => {
  const canSeeRates = useCan('schedule.view_rates');
  return (
    <dl className="rounded-lg border border-slate-800 bg-slate-900/60 px-4">
      <Row label="Type">{resource.resource_type_display || resource.resource_type}</Row>
      <Row label="Department">{resource.department_name || '—'}</Row>
      <Row label="Work calendar">{resource.calendar_name || 'The default calendar'}</Row>
      <Row label="Capacity">{formatHours(resource.capacity_hours_per_week)} per week</Row>
      {/* null: the caller may not read this person's rate; the server decides (schedule.view_rates, or the resource is their own) */}
      {(canSeeRates || resource.hourly_rate_usd !== null) && <Row label="Hourly rate">{formatRate(resource.hourly_rate_usd)}</Row>}
      {resource.user_email && <Row label="User account">{resource.user_email}</Row>}
      <Row label="Location">{resource.location || '—'}</Row>
    </dl>
  );
};

const BookingsPanel: React.FC<{ resourceId: string }> = ({ resourceId }) => <DirectoryListPage config={useBookingsListConfig({ resourceId })} />;

const LeavePanel: React.FC<{ resourceId: string }> = ({ resourceId }) => {
  const config = useLeavesListConfig();
  return <DirectoryListPage config={{ ...config, scope: { resource_id: resourceId }, createQuery: `resource=${resourceId}` }} />;
};

export const ResourceWorkspace: React.FC = () => {
  const { resourceId = '' } = useParams();
  const canManage = useCan('schedule.manage');
  const canUpdate = useCan('schedule.update');
  const [tab, setTab] = useState<TabId>('details');
  const query = useQuery({ queryKey: resourcesApi.keys.detail(resourceId), queryFn: ({ signal }) => resourcesApi.get(resourceId, signal), enabled: Boolean(resourceId) });
  const resource = query.data;
  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="resource">
        {resource && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/scheduling/resources" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Resources
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {resource.code} · {resource.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1">{[resource.resource_type_display, resource.department_name, resource.location].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <Badge variant={resourceStatusVariant(resource.status)}>{resource.status}</Badge>
                <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Resource actions">
                  {canManage && (
                    <>
                      <Link to={`/scheduling/bookings/new?resource=${resource.id}&status=Booked`}>
                        <Button size="sm" variant="primary">
                          Book time
                        </Button>
                      </Link>
                      <Link to={`/scheduling/bookings/new?resource=${resource.id}&status=Blocked`}>
                        <Button size="sm" variant="outline">
                          Block time
                        </Button>
                      </Link>
                    </>
                  )}
                  {canUpdate && (
                    <Link to={`/scheduling/resources/${resource.id}/edit`}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div role="tablist" aria-label="Resource sections" className="flex flex-wrap gap-1 border-b border-slate-800">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-xs font-semibold ${tab === t.id ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'details' && <DetailsPanel resource={resource} />}
            {tab === 'bookings' && <BookingsPanel resourceId={resource.id} />}
            {tab === 'leave' && <LeavePanel resourceId={resource.id} />}
            {tab === 'changes' && <EntityHistory targetType="Resource" targetId={resource.id} />}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

