import type React from 'react';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { sequencesConfig } from '../../structure/configs';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectSequencesTab: React.FC<Props> = ({ project }) => <RelatedRecords config={sequencesConfig} parentId={project.id} />;
