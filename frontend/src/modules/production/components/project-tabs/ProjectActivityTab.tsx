import type React from 'react';
import { EntityHistory } from '@/components/history/EntityHistory';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectActivityTab: React.FC<Props> = ({ project }) => <EntityHistory targetType="Project" targetId={project.id} title="Project history" />;
