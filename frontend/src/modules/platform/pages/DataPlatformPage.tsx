import React, { useState } from 'react';
import { EntityType } from '@/types/crud';
import { EntityList } from '@/shared/crud/EntityList';
import { SHOT_FIELDS, TASK_FIELDS, PROJECT_FIELDS } from '@/shared/crud/fieldSchemas';
import { useShots } from '@/modules/shots/hooks/useShots';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Clapperboard, CheckSquare, Film } from 'lucide-react';

export const DataPlatformPage: React.FC = () => {
  const [activeEntityType, setActiveEntityType] = useState<EntityType>('shot');

  const { data: shotsData } = useShots({ page_size: 200 });
  const { data: tasksData } = useTasks({ page_size: 200 });
  const { data: projectsData } = useProjects({ page_size: 200 });

  const shots = shotsData?.results ?? [];
  const tasks = tasksData?.results ?? [];
  const projects = projectsData?.results ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
              StudioHub Universal Platform
            </span>
            <span className="text-xs text-slate-400 font-medium">Part 07 Core</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Universal CRUD & Multi-View Data Engine
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Unified production data architecture supporting 7 view modes (Table, Grid, Board, Timeline, Calendar, Hierarchy, Gallery), nested AND/OR condition builders, saved views, and ID-backed relationship graph traversal.
          </p>
        </div>

        {/* Entity Switcher Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveEntityType('shot')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeEntityType === 'shot'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Shots ({shots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEntityType('task')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeEntityType === 'task'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Tasks ({tasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveEntityType('project')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeEntityType === 'project'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Projects ({projects.length})</span>
          </button>
        </div>
      </div>

      {/* Dynamic Entity CRUD Container */}
      {activeEntityType === 'shot' && (
        <EntityList
          key="shot-list"
          entityType="shot"
          items={shots}
          fields={SHOT_FIELDS}
          initialViewMode="table"
        />
      )}

      {activeEntityType === 'task' && (
        <EntityList
          key="task-list"
          entityType="task"
          items={tasks}
          fields={TASK_FIELDS}
          initialViewMode="board"
          initialGroupBy="status"
        />
      )}

      {activeEntityType === 'project' && (
        <EntityList
          key="project-list"
          entityType="project"
          items={projects}
          fields={PROJECT_FIELDS}
          initialViewMode="grid"
        />
      )}
    </div>
  );
};
