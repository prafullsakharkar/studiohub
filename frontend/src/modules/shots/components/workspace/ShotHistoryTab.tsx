import React from 'react';
import { Shot } from '@/types/production';
import { Clock, CheckCircle2, GitCommit, FileText, Sparkles, ShieldCheck } from 'lucide-react';
import { Card, CardBody } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';

export interface ShotHistoryTabProps {
  shot: Shot;
}

export const ShotHistoryTab: React.FC<ShotHistoryTabProps> = ({ shot }) => {
  const milestones = [
    {
      title: 'VFX Supervisor Sign-off & Final Lock',
      date: shot.supervisor_approved ? 'Today at 10:15' : 'Pending',
      status: shot.supervisor_approved ? 'Completed' : 'Upcoming',
      description: 'Supervisor validation of composite passes and final grading lock.',
      icon: ShieldCheck,
      color: 'emerald',
    },
    {
      title: 'Hero Version Published (v003)',
      date: 'Yesterday at 17:40',
      status: 'Completed',
      description: 'Submitted 4K EXR sequence for dailies screening and sequence review.',
      icon: Sparkles,
      color: 'indigo',
    },
    {
      title: 'Lighting & FX Cache Ingest',
      date: '3 days ago',
      status: 'Completed',
      description: 'Houdini smoke simulation and Maya Arnold lighting render layers confirmed.',
      icon: GitCommit,
      color: 'indigo',
    },
    {
      title: 'Editorial Cut Turnover & Conforming',
      date: '5 days ago',
      status: 'Completed',
      description: `Ingested 10-bit DPX plates from AVID timeline. Frame range ${shot.frame_in} - ${shot.frame_out} (${shot.frame_count} frames) locked.`,
      icon: FileText,
      color: 'slate',
    },
    {
      title: 'Shot Entity Created in StudioHub',
      date: shot.created_at ? new Date(shot.created_at).toLocaleDateString() : 'Initial Turnover',
      status: 'Completed',
      description: `Registered shot ${shot.code} in sequence ${shot.sequence_code}.`,
      icon: Clock,
      color: 'slate',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Production Milestone Timeline
          </span>
        </div>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {milestones.map((m, idx) => {
          const Icon = m.icon;
          const isDone = m.status === 'Completed';

          return (
            <div key={idx} className="relative group">
              <div
                className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 ring-4 ring-slate-950 ${
                  isDone
                    ? 'bg-indigo-500 border-indigo-400'
                    : 'bg-slate-900 border-slate-700'
                }`}
              />

              <Card className="border-slate-800 bg-slate-900 shadow-xs">
                <CardBody className="p-4 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-bold text-white">{m.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isDone ? 'success' : 'neutral'}
                        className="text-[9px] uppercase font-mono"
                      >
                        {m.status}
                      </Badge>
                      <span className="text-[10px] font-mono text-slate-500">{m.date}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{m.description}</p>
                </CardBody>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};
