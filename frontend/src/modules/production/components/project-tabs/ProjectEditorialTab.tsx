import type React from 'react';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { tracksConfig } from '../../structure/configs';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectEditorialTab: React.FC<Props> = ({ project }) => <RelatedRecords config={tracksConfig} parentId={project.id} />;
