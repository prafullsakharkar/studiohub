// Public boundary for the teams module.
// External code imports from '@/modules/teams', never deep paths.
export { TeamsListPage } from './pages/TeamsListPage';
export { CreateTeamPage } from './pages/CreateTeamPage';
export { EditTeamPage } from './pages/EditTeamPage';
export { TeamWorkspacePage } from './pages/TeamWorkspacePage';
export {
  useTeams,
  useTeam,
  useTeamMutations,
  TEAMS_QUERY_KEYS,
} from './hooks/useTeamsData';
