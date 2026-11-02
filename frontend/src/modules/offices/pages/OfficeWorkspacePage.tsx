import { useQuery } from '@tanstack/react-query';
import { Building } from 'lucide-react';
import type React from 'react';
import { useParams } from 'react-router-dom';
import { officesApi } from '@/api/masterdata/directory';
import { EntityHistory } from '@/components/history/EntityHistory';
import { Badge } from '@/shared/components/Badge';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { PeopleTab } from '@/modules/directory/workspace/PeopleTab';
import { PersonLabel } from '@/modules/directory/workspace/PersonLabel';
import { RecordActions } from '@/modules/directory/workspace/RecordActions';
import { WorkspaceShell, type WorkspaceTab } from '@/modules/directory/workspace/WorkspaceShell';

export const OfficeWorkspacePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: officesApi.keys.detail(id), queryFn: ({ signal }) => officesApi.get(id, signal), enabled: id !== '' });
  const office = query.data;

  const tabs: WorkspaceTab[] = office
    ? [
        {
          id: 'overview',
          label: 'Overview',
          render: () => (
            <DetailGrid
              title="Office"
              description={office.description}
              items={[
                { label: 'Code', value: office.code },
                { label: 'Type', value: office.office_type },
                { label: 'Manager', value: <PersonLabel id={office.manager} /> },
                { label: 'Headcount', value: office.headcount },
                { label: 'Workstations', value: office.workstations_count },
                { label: 'Render nodes', value: office.render_nodes_count },
                { label: 'Address', value: [office.address, office.postal_code, office.city, office.state, office.country].filter(Boolean).join(', ') },
                { label: 'Timezone', value: office.timezone },
                { label: 'Working hours', value: office.working_hours },
                { label: 'Phone', value: office.phone },
                { label: 'Email', value: office.email },
              ]}
            />
          ),
        },
        { id: 'people', label: 'People', render: () => <PeopleTab field="office" parentId={office.id} parentName={office.name} /> },
        { id: 'history', label: 'History', render: () => <EntityHistory targetType="Office" targetId={office.id} title="Office history" /> },
      ]
    : [];

  return (
    <WorkspaceShell
      noun="office"
      backPath="/offices"
      backLabel="Offices"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      record={
        office
          ? {
              title: office.name,
              code: office.code,
              icon: <Building className="w-6 h-6" />,
              badges: (
                <>
                  <Badge variant={office.is_active ? 'success' : 'neutral'}>{office.is_active ? 'Active' : 'Inactive'}</Badge>
                  {office.is_headquarters && <Badge variant="info">Headquarters</Badge>}
                </>
              ),
              subtitle: [office.city, office.country].filter(Boolean).join(', '),
            }
          : null
      }
      actions={office && <RecordActions noun="office" name={office.name} id={office.id} basePath="/offices" queryKey={officesApi.keys.all} managePermission="masterdata.directory.manage" remove={officesApi.remove} />}
      tabs={tabs}
    />
  );
};
