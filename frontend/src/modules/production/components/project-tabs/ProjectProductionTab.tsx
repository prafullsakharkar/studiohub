import React from 'react';
import { Film } from 'lucide-react';
import { Project } from '@/types/projects';
import { Sequence } from '@/types/sequences';
import { useSequences } from '@/modules/sequences/hooks/useSequences';
import { Badge } from '@/shared/components/Badge';

interface ProjectProductionTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

const statusVariant = (status: string) => {
  if (['Approved', 'final_approved', 'Completed', 'Final Color'].includes(status)) return 'success';
  if (['In Progress', 'in_progress', 'Turnover'].includes(status)) return 'info';
  if (['Pending Review', 'ready_for_review', 'Bidding'].includes(status)) return 'warning';
  if (['Retake', 'changes_requested'].includes(status)) return 'error';
  if (['On Hold', 'on_hold', 'Omitted', 'Archived'].includes(status)) return 'neutral';
  return 'secondary';
};

export const ProjectProductionTab: React.FC<ProjectProductionTabProps> = ({
  project,
  onNavigateTab,
}) => {
  const { data: sequencesData, isLoading } = useSequences({
    project_id: project.id,
    page_size: 50,
  });
  const sequences: Sequence[] = (sequencesData as any)?.results ?? sequencesData ?? [];

  return (
    <div className="space-y-6">
      {/* Top Production Overview Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
        <span className="text-xs font-mono text-slate-400">Production Scope</span>
        <div className="text-2xl font-bold font-mono text-white">
          {isLoading ? '…' : `${sequences.length} Sequences / ${project.total_shots} Shots`}
        </div>
        <p className="text-[11px] text-slate-400 font-mono">
          {project.name} — {project.status}
        </p>
      </div>

      {/* Sequence Breakdown Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              Sequence Production Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reel-by-reel breakdown with shot counts and current status
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('shots')}
            className="text-xs font-mono text-indigo-400 hover:text-indigo-300"
          >
            Explore Shots →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-400 md:col-span-3">
              Loading sequences…
            </div>
          )}
          {!isLoading &&
            sequences.map((seq) => (
              <div
                key={seq.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-indigo-400">{seq.code}</span>
                  <Badge variant={statusVariant(seq.status)}>{seq.status}</Badge>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{seq.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {seq.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Shots: <strong className="text-slate-200">{seq.shots_count}</strong>
                  </span>
                  <span className="font-mono text-slate-500">{seq.department || '—'}</span>
                </div>
              </div>
            ))}
          {!isLoading && sequences.length === 0 && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-xs text-slate-500 md:col-span-3">
              No sequences found for this project.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
