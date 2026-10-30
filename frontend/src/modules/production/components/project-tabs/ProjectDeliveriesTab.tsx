import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useDeliveriesListConfig } from '@/modules/deliveries/deliveries';
import type { Project } from '@/types/production';

interface ProjectDeliveriesTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's deliveries, from the project route (the list route ignores a project filter, CR-17). */
export const ProjectDeliveriesTab: React.FC<ProjectDeliveriesTabProps> = ({ project }) => <DirectoryListPage config={useDeliveriesListConfig({ projectId: project.id })} />;
