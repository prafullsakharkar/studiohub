import type React from 'react';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import type { Department } from '@/api/masterdata/departments';
import { AssignmentChoice } from './AssignmentChoice';

/** The person's department (one at most); saved as the person's `department`. */
export const PersonDepartmentsTab: React.FC<{ currentDepartmentId: string | null | undefined; onAssignDepartment: (departmentId: string | null) => Promise<unknown> }> = ({ currentDepartmentId, onAssignDepartment }) => (
  <AssignmentChoice<Department> noun="department" queryKey={departmentKeys.all} fetchPage={departmentsApi.list} currentId={currentDepartmentId} onAssign={onAssignDepartment} describe={(d) => d.department_type} />
);
