// Public boundary for the shots module.
// External code imports from '@/modules/shots', never deep paths.
export { ShotBulkManager } from './components/bulk/ShotBulkManager';
export { useBulkShots } from './hooks/useBulkShots';
export { useShotMutations } from './hooks/useShotMutations';
export { SHOT_QUERY_KEYS } from './hooks/useShots';
export { useShots } from './hooks/useShots';
export { ShotWorkspacePage } from './pages/ShotWorkspacePage';
export { ShotsPage } from './pages/ShotsPage';
