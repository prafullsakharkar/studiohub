// Public boundary for the departments module.
// External code imports from '@/modules/departments', never deep paths.
export { DepartmentsListPage } from './pages/DepartmentsListPage';
export { CreateDepartmentPage } from './pages/CreateDepartmentPage';
export { DepartmentWorkspacePage } from './pages/DepartmentWorkspacePage';
export { EditDepartmentPage } from './pages/EditDepartmentPage';
export {
  useDepartments,
  useDepartment,
  useDepartmentMutations,
  DEPARTMENTS_QUERY_KEYS,
} from './hooks/useDepartmentsData';
