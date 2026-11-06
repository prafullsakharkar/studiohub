// Public boundary for the production module.
// External code imports from '@/modules/production', never deep paths.
export { PROJECT_QUERY_KEYS, useProjects } from './hooks/useProjects';
export { ProjectFormPage } from './pages/ProjectFormPage';
export { ProjectWorkspacePage } from './pages/ProjectWorkspacePage';
export { ProjectsPage } from './pages/ProjectsPage';
export { ShowRedirectPage } from './pages/ShowRedirectPage';
export { useActiveProjectIsEpisodic, useProjectIsEpisodic } from './hooks/useProjectIsEpisodic';
export { isEpisodicProject } from './projectWorkflow';
export { EpisodeFormPage, EpisodesPage, SequenceFormPage, SequencesPage } from './pages/StructurePages';
