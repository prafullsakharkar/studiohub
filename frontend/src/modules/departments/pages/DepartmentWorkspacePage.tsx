import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import type React from 'react';
import { Link, useParams } from 'react-router-dom';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import { EntityHistory } from '@/components/history/EntityHistory';
import { Badge } from '@/shared/components/Badge';
import { DetailGrid } from '@/modules/directory/workspace/DetailGrid';
import { PeopleTab } from '@/modules/directory/workspace/PeopleTab';
import { PersonLabel } from '@/modules/directory/workspace/PersonLabel';
import { RecordActions } from '@/modules/directory/workspace/RecordActions';
import { TeamsOfDepartment } from '@/modules/directory/workspace/TeamsOfDepartment';
import { WorkspaceShell, type WorkspaceTab } from '@/modules/directory/workspace/WorkspaceShell';

export const DepartmentWorkspacePage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: departmentKeys.detail(id), queryFn: ({ signal }) => departmentsApi.get(id, signal), enabled: id !== '' });
  const dept = query.data;

  const tabs: WorkspaceTab[] = dept
    ? [
        {
          id: 'overview',
          label: 'Overview',
          render: () => (
            <DetailGrid
              title="Department"
              description={dept.description}
              items={[
                { label: 'Code', value: dept.code },
                { label: 'Type', value: dept.department_type },
                { label: 'Manager', value: <PersonLabel id={dept.manager} /> },
                { label: 'Parent department', value: dept.parent ? <ParentDepartment id={dept.parent} /> : null },
                { label: 'Color', value: dept.color },
                { label: 'Software stack', value: dept.software_stack?.length ? dept.software_stack.join(', ') : null },
              ]}
            />
          ),
        },
        { id: 'teams', label: 'Teams', render: () => <TeamsOfDepartment departmentId={dept.id} departmentName={dept.name} /> },
        { id: 'people', label: 'People', render: () => <PeopleTab field="department" parentId={dept.id} parentName={dept.name} /> },
        { id: 'history', label: 'History', render: () => <EntityHistory targetType="Department" targetId={dept.id} title="Department history" /> },
      ]
    : [];

  return (
    <WorkspaceShell
      noun="department"
      backPath="/departments"
      backLabel="Departments"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      record={dept ? { title: dept.name, code: dept.code, icon: <Layers className="w-6 h-6" />, badges: <Badge variant="info">{dept.department_type}</Badge> } : null}
      actions={dept && <RecordActions noun="department" name={dept.name} id={dept.id} basePath="/departments" queryKey={departmentKeys.all} managePermission="masterdata.directory.manage" remove={departmentsApi.remove} />}
      tabs={tabs}
    />
  );
};

/** The parent department, by name and linked. */
const ParentDepartment: React.FC<{ id: string }> = ({ id }) => {
  const parent = useQuery({ queryKey: departmentKeys.detail(id), queryFn: ({ signal }) => departmentsApi.get(id, signal), staleTime: 60_000 });
  return parent.data ? <Link to={`/departments/${id}`} className="text-indigo-300 hover:underline">{parent.data.name}</Link> : <>{parent.isError ? 'Unavailable' : '…'}</>;
};
