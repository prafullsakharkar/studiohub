import type React from 'react';
import { PipelinePanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectPipelineTab: React.FC<Props> = ({ project }) => <PipelinePanel projectId={project.id} />;
