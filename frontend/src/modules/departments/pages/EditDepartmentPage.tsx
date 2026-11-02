import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useParams } from 'react-router-dom';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { DepartmentForm } from './CreateDepartmentPage';

export const EditDepartmentPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: departmentKeys.detail(id), queryFn: ({ signal }) => departmentsApi.get(id, signal), enabled: id !== '' });
  return (
    <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="department">
      {query.data && <DepartmentForm key={query.data.id} department={query.data} />}
    </QueryBoundary>
  );
};
