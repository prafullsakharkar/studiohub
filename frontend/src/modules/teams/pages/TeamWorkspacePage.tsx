import { useQuery } from '@tanstack/react-query';
import { Users2 } from 'lucide-react';
import type React from 'react';
import { Link, useParams } from 'react-router-dom';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import { teamsApi } from '@/api/masterdata/directory';
import { EntityHistory } from '@/components/history/EntityHistory';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { PersonLabel } from '@/modules/directory/workspace/PersonLabel';
import { RecordActions } from '@/modules/directory/workspace/RecordActions';
import { TeamMembersTab } from '@/modules/directory/workspace/TeamMembersTab';
import { WorkspaceShell, type WorkspaceTab } from '@/modules/directory/workspace/WorkspaceShell';

const DepartmentLink: React.FC<{ id: string }> = ({ id }) => {
  const query = useQuery({ queryKey: departmentKeys.detail(id), queryFn: ({ signal }) => departmentsApi.get(id, signal), staleTime: 60_000 });
  return query.data ? <Link to={`/departments/${id}`} className="text-indigo-300 hover:underline">{query.data.name}</Link> : <>{query.isError ? 'Unavailable' : '…'}</>;
};

export const TeamWorkspacePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: teamsApi.keys.detail(id), queryFn: ({ signal }) => teamsApi.get(id, signal), enabled: id !== '' });
  const team = query.data;

  const tabs: WorkspaceTab[] = team
    ? [
        {
          id: 'overview',
          label: 'Overview',
          render: () => (
            <DetailGrid
              title="Team"
              description={team.description}
              items={[
                { label: 'Code', value: team.code },
                { label: 'Department', value: <DepartmentLink id={team.department} /> },
                { label: 'Lead', value: <PersonLabel id={team.lead} /> },
                { label: 'Members', value: team.member_count },
                { label: 'Focus discipline', value: team.focus_discipline },
                { label: 'Current project code', value: team.current_project_code },
                { label: 'Capacity', value: team.capacity },
                { label: 'Color', value: team.color },
              ]}
            />
          ),
        },
        { id: 'members', label: 'Members', render: () => <TeamMembersTab teamId={team.id} teamName={team.name} /> },
        { id: 'history', label: 'History', render: () => <EntityHistory targetType="Team" targetId={team.id} title="Team history" /> },
      ]
    : [];

  return (
    <WorkspaceShell
      noun="team"
      backPath="/teams"
      backLabel="Teams"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      record={team ? { title: team.name, code: team.code, icon: <Users2 className="w-6 h-6" /> } : null}
      actions={team && <RecordActions noun="team" name={team.name} id={team.id} basePath="/teams" queryKey={teamsApi.keys.all} managePermission="masterdata.directory.manage" remove={teamsApi.remove} />}
      tabs={tabs}
    />
  );
};
