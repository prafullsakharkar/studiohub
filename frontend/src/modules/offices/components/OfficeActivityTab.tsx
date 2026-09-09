import React from 'react';
import { Activity } from 'lucide-react';
import { OfficeEntity } from '@/types/organization';

export const OfficeActivityTab: React.FC<{ office: OfficeEntity }> = ({ office }) => {
  const events = [
    {
      id: 'oact-1',
      title: 'DCI Screening Room Color Calibration Completed',
      time: '5 hours ago',
      details: 'Master calibration verified against ACES 1.3 standard for client screening.',
    },
    {
      id: 'oact-2',
      title: 'Render Cluster Node Expansion',
      time: '2 days ago',
      details: 'Added 48 high-memory compute blades to primary local render pool.',
    },
    {
      id: 'oact-3',
      title: 'Facility General Manager Appointed',
      time: '1 week ago',
      details: `${office.manager_name} confirmed as site operations director.`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Site Activity & Infrastructure Log
          </h3>
          <p className="text-xs text-slate-400">
            Audit history of facility upgrades, hardware maintenance, and operational changes.
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
