import type React from 'react';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { isEpisodicProject } from '../../projectWorkflow';
import { sequencesConfigFor } from '../../structure/configs';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectSequencesTab: React.FC<Props> = ({ project }) => <RelatedRecords config={sequencesConfigFor(isEpisodicProject(project))} parentId={project.id} />;
