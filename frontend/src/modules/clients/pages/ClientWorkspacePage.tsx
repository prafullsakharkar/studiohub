import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import type React from 'react';
import { useParams } from 'react-router-dom';
import { clientsApi } from '@/api/masterdata/directory';
import { EntityHistory } from '@/components/history/EntityHistory';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { ProjectsOfClient } from '@/modules/directory/workspace/ProjectsOfClient';
import { RecordActions } from '@/modules/directory/workspace/RecordActions';
import { WorkspaceShell, type WorkspaceTab } from '@/modules/directory/workspace/WorkspaceShell';
import { ClientContactsTab } from '../components/client-tabs/ClientContactsTab';
import { ClientContractsTab } from '../components/client-tabs/ClientContractsTab';

export const ClientWorkspacePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const canSeeProjects = useCan('project.view');
  const canSeeFinancials = useCan('masterdata.client.view_financial');
  const query = useQuery({ queryKey: clientsApi.keys.detail(id), queryFn: ({ signal }) => clientsApi.get(id, signal), enabled: id !== '' });
  const client = query.data;

  const tabs: WorkspaceTab[] = client
    ? [
        {
          id: 'overview',
          label: 'Overview',
          render: () => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <DetailGrid
                  title="Client"
                  items={[
                    { label: 'Code', value: client.code },
                    { label: 'Status', value: client.status },
                    { label: 'Studio type', value: client.studio_type },
                    { label: 'Contract tier', value: client.contract_tier },
                    { label: 'Headquarters', value: client.headquarters },
                    { label: 'Portal access', value: client.portal_access ? 'Yes' : 'No' },
                    { label: 'Main contact', value: client.contact_name },
                    { label: 'Email', value: client.email },
                    { label: 'Phone', value: client.phone },
                    ...(canSeeFinancials && client.total_billed_usd !== undefined ? [{ label: 'Total billed (USD)', value: String(client.total_billed_usd) }] : []),
                  ]}
                />
              </div>
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white">Contacts</h3>
                <div className="text-3xl font-black text-white font-mono">{client.contact_count}</div>
                <p className="text-xs text-slate-400">People recorded for this client.</p>
              </div>
            </div>
          ),
        },
        ...(canSeeProjects ? [{ id: 'projects', label: 'Projects', render: () => <ProjectsOfClient clientName={client.name} /> }] : []),
        { id: 'contacts', label: 'Contacts', render: () => <ClientContactsTab clientId={client.id} /> },
        { id: 'contracts', label: 'Contracts', render: () => <ClientContractsTab clientId={client.id} /> },
        { id: 'history', label: 'History', render: () => <EntityHistory targetType="Client" targetId={client.id} title="Client history" /> },
      ]
    : [];

  return (
    <WorkspaceShell
      noun="client"
      backPath="/clients"
      backLabel="Directory"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      record={client ? { title: client.name, code: client.code, icon: <Building2 className="w-6 h-6" />, badges: <Badge variant={client.status === 'Active' ? 'success' : 'neutral'}>{client.status || '—'}</Badge>, subtitle: client.headquarters } : null}
      actions={
        client && (
          <RecordActions
            noun="client"
            name={client.name}
            id={client.id}
            basePath="/clients"
            queryKey={clientsApi.keys.all}
            managePermission="masterdata.directory.manage"
            remove={clientsApi.remove}
            status={{ current: client.status, archived: 'Archived', active: 'Active', set: (cid, status) => clientsApi.update(cid, { status }) }}
          />
        )
      }
      tabs={tabs}
    />
  );
};
