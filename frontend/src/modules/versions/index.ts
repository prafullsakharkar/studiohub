// Public boundary for the versions module.
// External code imports from '@/modules/versions', never deep paths.
export { VERSION_KEYS } from './hooks/useVersions';
export { useVersions } from './hooks/useVersions';
export { VersionWorkspacePage } from './pages/VersionWorkspacePage';
export { VersionFormPage, VersionsListPage } from './pages/VersionsListPage';
export { versionService } from './services/VersionService';
