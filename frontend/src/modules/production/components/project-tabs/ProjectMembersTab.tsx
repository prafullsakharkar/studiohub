import type React from 'react';
import { MembersPanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectMembersTab: React.FC<Props> = ({ project }) => <MembersPanel projectId={project.id} />;
