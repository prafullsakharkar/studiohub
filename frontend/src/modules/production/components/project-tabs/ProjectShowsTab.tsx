import type React from 'react';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { showsConfig } from '../../structure/configs';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectShowsTab: React.FC<Props> = ({ project }) => <RelatedRecords config={showsConfig} parentId={project.id} />;
