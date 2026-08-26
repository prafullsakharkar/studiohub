import React from 'react';
import {
  Activity,
  GitCommit,
  Upload,
  CheckCircle2,
  Database,
  Film,
  MessageSquare,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { Badge } from '@/shared/components/Badge';

interface VersionActivityTabProps {
  version: ProductionVersion;
}

export const VersionActivityTab: React.FC<VersionActivityTabProps> = ({ version }) => {
  const events = [
    {
      id: 'act-1',
      type: 'publish',
      title: 'Published to OpenUSD Pipeline',
      description: `Stage master /shows/${version.project_code}/usd/master/${version.version_number}.usd compiled with ACEScg color space.`,
      user: 'Alex Vance (Lead TD)',
      time: '2 hours ago',
      icon: <Database className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'act-2',
      type: 'review',
      title: 'Review Approved by VFX Supervisor',
      description: 'Elena Rostova approved the render for layout integration signoff.',
      user: 'Elena Rostova',
      time: '4 hours ago',
      icon: <CheckCircle2 className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'act-3',
      type: 'media',
      title: 'Multi-Channel EXR Render Stream Ingested',
      description: `Ingested ${version.frame_count} frames (${version.resolution}) via render farm worker pool.`,
      user: 'Deadline Farm Worker #14',
      time: '6 hours ago',
      icon: <Film className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'act-4',
      type: 'create',
      title: 'Version Record Created',
      description: `Version ${version.version_number} (${version.code}) initialized for task ${version.task_name || version.task_title || version.task_code || 'Task'}.`,
      user: version.artist?.name || version.artist_name || 'Artist',
      time: '8 hours ago',
      icon: <GitCommit className="w-4 h-4 text-cyan-400" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-sm font-mono font-bold text-slate-200 uppercase">
            Audit Trail & Pipeline Activity
          </h3>
          <p className="text-xs text-slate-400">
            Immutable log of render submissions, QC decisions, USD publishes, and attachments for {version.version_number}.
          </p>
        </div>
      </div>

      <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-4 my-4">
        {events.map((evt) => (
          <div key={evt.id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-[31px] top-1 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow-md">
              {evt.icon}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1.5 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono font-bold text-slate-200">{evt.title}</span>
                <span className="text-[11px] font-mono text-slate-500">{evt.time}</span>
              </div>
              <p className="text-xs font-mono text-slate-400">{evt.description}</p>
              <div className="pt-1 text-[11px] font-mono text-slate-500">
                Triggered by: <span className="text-slate-300">{evt.user}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
