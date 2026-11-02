import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from 'lucide-react';
import type React from 'react';
import { Link, useParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import { officesApi, peopleApi, positionsApi, teamsApi } from '@/api/masterdata/directory';
import { EntityHistory } from '@/components/history/EntityHistory';
import { AccountSection } from '@/modules/identity/components/AccountSection';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { WorkspaceShell, type WorkspaceTab } from '@/modules/directory/workspace/WorkspaceShell';
import { Badge } from '@/shared/components/Badge';
import { PersonAssignmentsTab } from '../components/PersonAssignmentsTab';
import { PersonDepartmentsTab } from '../components/PersonDepartmentsTab';
import { PersonLifecycle } from '../components/PersonLifecycle';
import { PersonSkillsTab } from '../components/PersonSkillsTab';
import { PersonTeamsTab } from '../components/PersonTeamsTab';

const STATUS_VARIANT = { active: 'success', draft: 'info', inactive: 'warning', archived: 'neutral' } as const;

/** A referenced record by name, linked to its page; the API sends only the id (and, for three of them, the name). */
function Named({ id, to, queryKey, load }: { id: string | null | undefined; to?: string; queryKey: readonly unknown[]; load: (id: string, signal?: AbortSignal) => Promise<{ name: string }> }) {
  const query = useQuery({ queryKey, queryFn: ({ signal }) => load(id as string, signal), enabled: Boolean(id), staleTime: 60_000 });
  if (!id) return null;
  if (!query.data) return <>{query.isError ? 'Unavailable' : '…'}</>;
  return to ? <Link to={`${to}/${id}`} className="text-indigo-300 hover:underline">{query.data.name}</Link> : <>{query.data.name}</>;
}

export const PersonWorkspacePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: peopleApi.keys.detail(id), queryFn: ({ signal }) => peopleApi.get(id, signal), enabled: id !== '' });
  const person = query.data;

  // A person's team and department are chosen on their tabs; the choice is the person's own `team` / `department`.
  const assign = (field: 'team' | 'department') => async (value: string | null) => {
    await peopleApi.update(id, { [field]: value });
    await Promise.all([queryClient.invalidateQueries({ queryKey: peopleApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
  };

  const tabs: WorkspaceTab[] = person
    ? [
        {
          id: 'overview',
          label: 'Overview',
          render: () => {
            const skills = Array.isArray(person.skills) ? (person.skills as string[]) : [];
            return (
              <DetailGrid
                title="Person"
                description={person.description}
                items={[
                  { label: 'Status', value: person.status },
                  { label: 'Position', value: <Named id={person.role} queryKey={positionsApi.keys.detail(person.role ?? '')} load={positionsApi.get} /> },
                  { label: 'Seniority', value: person.seniority },
                  { label: 'Department', value: <Named id={person.department} to="/departments" queryKey={departmentKeys.detail(person.department ?? '')} load={departmentsApi.get} /> },
                  { label: 'Primary team', value: <Named id={person.team} to="/teams" queryKey={teamsApi.keys.detail(person.team ?? '')} load={teamsApi.get} /> },
                  { label: 'Office', value: <Named id={person.office} to="/offices" queryKey={officesApi.keys.detail(person.office ?? '')} load={officesApi.get} /> },
                  { label: 'Timezone', value: person.timezone },
                  { label: 'Availability', value: person.availability_status },
                  { label: 'Skills', value: skills.length ? skills.join(', ') : null },
                  // The API leaves these out for callers without masterdata.person.view_sensitive.
                  ...(person.email !== undefined ? [{ label: 'Email', value: person.email }] : []),
                  ...(person.phone !== undefined ? [{ label: 'Phone', value: person.phone }] : []),
                  ...(person.security_clearance !== undefined ? [{ label: 'Security clearance', value: person.security_clearance }] : []),
                  ...(person.date_of_birth !== undefined ? [{ label: 'Date of birth', value: person.date_of_birth }] : []),
                  ...(person.nationality !== undefined ? [{ label: 'Nationality', value: person.nationality }] : []),
                ]}
              />
            );
          },
        },
        { id: 'teams', label: 'Teams', render: () => <PersonTeamsTab personId={person.id} personName={person.full_name} primaryTeamId={person.team} onSetPrimary={assign('team')} /> },
        { id: 'departments', label: 'Departments', render: () => <PersonDepartmentsTab currentDepartmentId={person.department} onAssignDepartment={assign('department')} /> },
        { id: 'skills', label: 'Skills', render: () => <PersonSkillsTab person={person} /> },
        { id: 'assignments', label: 'Assignments', render: () => <PersonAssignmentsTab userId={person.user} personName={person.full_name} /> },
        { id: 'account', label: 'Account', render: () => <AccountSection personId={person.id} personName={person.full_name} personEmail={person.email || undefined} userId={person.user} /> },
        { id: 'history', label: 'History', render: () => <EntityHistory targetType="Person" targetId={person.id} title="Person history" /> },
      ]
    : [];

  return (
    <WorkspaceShell
      noun="person"
      backPath="/people"
      backLabel="Roster"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      record={person ? { title: person.full_name, icon: <User className="w-6 h-6" />, badges: <Badge variant={STATUS_VARIANT[person.status ?? 'active']}>{person.status ?? 'active'}</Badge>, subtitle: [person.department_name, person.office_name].filter(Boolean).join(' • ') } : null}
      actions={person && <PersonLifecycle person={person} />}
      tabs={tabs}
    />
  );
};
