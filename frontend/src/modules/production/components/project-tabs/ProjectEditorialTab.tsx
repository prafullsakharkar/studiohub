import React, { useState } from 'react';
import {
  Film,
  Scissors,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
  Sparkles,
  Play,
  Download,
  Filter,
} from 'lucide-react';
import { Project } from '@/types/production';
import { useProjectEditorial } from '../../hooks/useProjectScopedData';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectEditorialTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectEditorialTab: React.FC<ProjectEditorialTabProps> = ({ project, onNavigateTab }) => {
  const [search, setSearch] = useState('');
  const [cutTypeFilter, setCutTypeFilter] = useState('ALL');
  const addNotification = useNotificationStore((s) => s.addNotification);

  const { data: editorialData, isLoading, refetch } = useProjectEditorial(project.id, {
    search: search || undefined,
  });

  const cuts = editorialData?.results || [];
  const filteredCuts = cuts.filter((cut) => {
    if (cutTypeFilter !== 'ALL' && cut.cut_type !== cutTypeFilter) return false;
    return true;
  });

  const handleDownloadEDL = (cutCode: string, filename: string) => {
    addNotification({
      type: 'info',
      title: 'EDL Manifest Downloaded',
      message: `Downloading ${filename} for cut ${cutCode}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Total Conformed Cuts</span>
            <Scissors className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-1">{cuts.length}</p>
          <span className="text-[11px] text-slate-500">Active project turnovers</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Total Matched Shots</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {cuts.reduce((acc, c) => acc + (c.matched_vfx_shots || 0), 0)}
          </p>
          <span className="text-[11px] text-emerald-500/80">100% frame-accurate</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Master Framerate</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-1">{project.fps} FPS</p>
          <span className="text-[11px] text-cyan-500/80">TC: 01:00:00:00 start</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Show Color LUT</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-sm font-bold text-white font-mono mt-2 truncate">
            {project.color_space || 'ACEScg (AP1)'}
          </p>
          <span className="text-[11px] text-slate-500">Rec.709 burn-in active</span>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
          <SearchInput
            placeholder="Search cut name, code, editor or EDL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <select
            value={cutTypeFilter}
            onChange={(e) => setCutTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Cut Types</option>
            <option value="Turnover">Turnover</option>
            <option value="Conform">Conform</option>
            <option value="Rough Cut">Rough Cut</option>
            <option value="Picture Lock">Picture Lock</option>
            <option value="Trailer Teaser">Trailer Teaser</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateTab('shots')}
            leftIcon={<Film className="w-3.5 h-3.5" />}
          >
            View Linked Shots
          </Button>
        </div>
      </div>

      {/* Cuts List */}
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredCuts.length === 0 ? (
        <EmptyState
          title="No Editorial Cuts Found"
          description={`No conformed turnover cuts or EDL manifests match the selected filter in ${project.name}.`}
          actionLabel="Clear Filter"
          onAction={() => {
            setSearch('');
            setCutTypeFilter('ALL');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCuts.map((cut) => (
            <div
              key={cut.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {cut.code}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{cut.cut_type}</span>
                    <StatusBadge status={cut.status} />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">{cut.name}</h3>
                </div>

                <div className="text-right font-mono text-xs text-slate-400">
                  <span className="text-white font-bold">{cut.duration_tc}</span>
                  <p className="text-[11px] text-slate-500">{cut.duration_frames} frames</p>
                </div>
              </div>

              {/* Cut Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Start TC</span>
                  <span className="text-slate-200">{cut.start_tc}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">End TC</span>
                  <span className="text-slate-200">{cut.end_tc}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">VFX Shots</span>
                  <span className="text-emerald-400 font-bold">{cut.matched_vfx_shots} matched</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Editor</span>
                  <span className="text-slate-300 truncate block">{cut.editor_name}</span>
                </div>
              </div>

              {cut.editorial_notes && (
                <p className="text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
                  <strong className="text-slate-400">Editorial Note:</strong> {cut.editorial_notes}
                </p>
              )}

              {/* Action row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" /> {cut.source_edl_filename}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadEDL(cut.code, cut.source_edl_filename)}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Export EDL
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onNavigateTab('shots')}
                    leftIcon={<Film className="w-3.5 h-3.5" />}
                  >
                    Open Shots
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
