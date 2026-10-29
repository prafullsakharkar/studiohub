import type React from 'react';
import { ResourcesPanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectResourcesTab: React.FC<Props> = ({ project }) => <ResourcesPanel projectId={project.id} />;
