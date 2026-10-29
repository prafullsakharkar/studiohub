import type React from 'react';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { episodesConfig } from '../../structure/configs';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

export const ProjectEpisodesTab: React.FC<Props> = ({ project }) => project.workflow_type === 'standard' ? (
  <p role="note" className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">This is a standard project: only episodic projects have episodes.</p>
) : (
  <RelatedRecords config={episodesConfig} parentId={project.id} />
);
