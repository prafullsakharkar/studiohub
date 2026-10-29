import type React from 'react';
import { SchedulePanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectScheduleTab: React.FC<Props> = ({ project }) => <SchedulePanel projectId={project.id} />;
