// Public boundary for the people module.
// External code imports from '@/modules/people', never deep paths.
export { PeopleListPage } from './pages/PeopleListPage';
export { CreatePersonPage } from './pages/CreatePersonPage';
export { EditPersonPage } from './pages/EditPersonPage';
export { PersonWorkspacePage } from './pages/PersonWorkspacePage';
export {
  usePeople,
  usePerson,
  usePersonMutations,
  PEOPLE_QUERY_KEYS,
} from './hooks/usePeopleData';
