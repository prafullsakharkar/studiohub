// Public boundary for the offices module.
// External code imports from '@/modules/offices', never deep paths.
export { OfficesListPage } from './pages/OfficesListPage';
export { CreateOfficePage } from './pages/CreateOfficePage';
export { EditOfficePage } from './pages/EditOfficePage';
export { OfficeWorkspacePage } from './pages/OfficeWorkspacePage';
export {
  useOffices,
  useOffice,
  useOfficeMutations,
  OFFICES_QUERY_KEYS,
} from './hooks/useOfficesData';
