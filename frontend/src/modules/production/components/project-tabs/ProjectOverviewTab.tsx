import type React from 'react';
import { OverviewPanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectOverviewTab: React.FC<Props> = ({ project }) => <OverviewPanel projectId={project.id} />
