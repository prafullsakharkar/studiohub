import { useAuth } from '@/modules/auth';
import React from 'react';
import {
  Film,
  Calendar,
  Building2,
  PlaySquare,
  Plus,
  RefreshCw,
  ExternalLink,
  Clapperboard,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardProjectMetadata } from '../types';
;

export interface DashboardHeaderProps {
  project: DashboardProjectMetadata;
  isFetching: boolean;
  onRefresh: () => void;
  onCreateShot?: () => void;
  onCreateTask?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  project,
  isFetching,
  onRefresh,
  onCreateShot,
  onCreateTask,
}) => {
  const { user } = useAuth();

  const formattedStartDate = project.start_date
    ? new Date(project.start_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'TBD';

  const formattedDeliveryDate = project.delivery_date
    ? new Date(project.delivery_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'TBD';

  return (
    <div
      id="dashboard-command-header"
      className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-4 shrink-0 transition-colors"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Project Identity & Specs */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0 shadow-lg shadow-indigo-500/5">
            <Film className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                {project.name}
              </h1>

              {/* Project Code Pill */}
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-full">
                [{project.code}]
              </span>

              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border flex items-center gap-1.5 ${
                  project.status === 'Active' || project.status === 'In Progress'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : project.status === 'Completed'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    project.status === 'Active' || project.status === 'In Progress'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                {project.status}
              </span>

              {/* Color Space Spec */}
              <span className="px-2 py-0.5 text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-full">
                {project.color_space || 'ACEScg 1.3'}
              </span>

              {/* Type / Phase */}
              <span className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                {project.type || 'Feature Film'}
              </span>
            </div>

            {/* Technical Subline */}
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              {project.client_name && (
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {project.client_name}
                </span>
              )}
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="font-mono text-slate-300">
                {project.resolution || '4096x2160 (4K DCI)'} @ {project.fps || 24} fps
              </span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="font-mono text-slate-400">Ratio: {project.aspect_ratio || '2.39:1'}</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="flex items-center gap-1 font-mono text-slate-400">
                <Calendar className="w-3 h-3 text-slate-500" />
                {formattedStartDate} → {formattedDeliveryDate}
              </span>
              {project.supervisor_name && (
                <>
                  <span className="text-slate-600 hidden sm:inline">•</span>
                  <span className="text-slate-300">
                    VFX Sup: <span className="font-semibold text-slate-200">{project.supervisor_name}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Command Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            title="Refresh project telemetry"
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Create Task Button */}
          {onCreateTask ? (
            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Create Task
            </button>
          ) : (
            <Link
              to={`/tasks?project=${project.id}&action=new`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Create Task
            </Link>
          )}

          {/* Create Shot Button */}
          {onCreateShot ? (
            <button
              type="button"
              onClick={onCreateShot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Clapperboard className="w-3.5 h-3.5 text-cyan-400" />
              Create Shot
            </button>
          ) : (
            <Link
              to={`/shots?project=${project.id}&action=new`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <Clapperboard className="w-3.5 h-3.5 text-cyan-400" />
              Create Shot
            </Link>
          )}

          {/* View Production Matrix */}
          <Link
            to="/shots"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 border border-indigo-500/30 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Layers className="w-3.5 h-3.5" />
            Shot Matrix
          </Link>

          {/* Open Full Project Workspace */}
          <Link
            to={`/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            Project Detail
          </Link>
        </div>
      </div>
    </div>
  );
};
