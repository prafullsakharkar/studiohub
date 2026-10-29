import type React from 'react';
import { NotesPanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectNotesTab: React.FC<Props> = ({ project }) => <NotesPanel projectId={project.id} />;
