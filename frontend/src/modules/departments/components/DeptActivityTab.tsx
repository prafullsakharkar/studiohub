import type React from 'react';
import { EntityHistory } from '@/components/history/EntityHistory';
import type { DepartmentEntity } from '@/types/masterData';

export const DeptActivityTab: React.FC<{ dept: DepartmentEntity }> = ({ dept }) => <EntityHistory targetType="Department" targetId={dept.id} title="Department history" />;
