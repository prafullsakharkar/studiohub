import React from 'react';
import { Activity, Clock, CheckCircle2, Shield, Upload, FileCode } from 'lucide-react';
import { Person } from '@/types/organization';

export const PersonActivityTab: React.FC<{ person: Person }> = ({ person }) => {
  const events = [
    {
      id: 'act-1',
      title: 'Published Version v004 for NK_010_010',
      type: 'publish',
      time: '12 minutes ago',
      details: 'Compositing final EXR beauty pass uploaded to review screening room.',
    },
    {
      id: 'act-2',
      title: 'Task Status Updated to In Progress',
      type: 'task',
      time: '2 hours ago',
      details: 'Assigned to shot NK_020_040 (Houdini Pyro Simulation).',
    },
    {
      id: 'act-3',
      title: 'Security Clearance Verified',
      type: 'security',
      time: 'Yesterday at 17:40',
      details: 'YubiKey hardware token re-authenticated for show NK99.',
    },
    {
      id: 'act-4',
      title: 'Logged 8.0 Hours',
      type: 'hours',
      time: '2 days ago',
      details: 'Time tracked on task TSK-4021 (Solaris LookDev).',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Artist Audit Trail & Session Log
          </h3>
          <p className="text-xs text-slate-400">
            Immutable log of publishing events, status changes, task completions, and security handshakes.
          </p>
        </div>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {events.map((evt) => (
          <div key={evt.id} className="relative group">
            <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-slate-950" />
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1 group-hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white">{evt.title}</span>
                <span className="text-[10px] font-mono text-slate-500">{evt.time}</span>
              </div>
              <p className="text-xs text-slate-400">{evt.details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
