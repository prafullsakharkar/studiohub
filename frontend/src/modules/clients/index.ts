// Public boundary for the clients module.
// External code imports from '@/modules/clients', never deep paths.
export { ClientsPage } from './pages/ClientsPage';
export { ClientCreatePage } from './pages/ClientCreatePage';
export { ClientWorkspacePage } from './pages/ClientWorkspacePage';
export {
  useClients,
  useClient,
  useClientMutations,
  CLIENTS_QUERY_KEYS,
} from './hooks/useClientsData';
export { ClientSelect } from './components/ClientSelect';
export { ClientContactSelect } from './components/ClientContactSelect';
