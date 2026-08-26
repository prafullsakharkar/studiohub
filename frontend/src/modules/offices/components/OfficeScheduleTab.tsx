import React from 'react';
import { Calendar, Clock, Sun, Moon, Flag } from 'lucide-react';
import { OfficeEntity } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const OfficeScheduleTab: React.FC<{ office: OfficeEntity }> = ({ office }) => {
  const holidays = [
    { name: 'New Year Day', date: '2026-01-01', type: 'Public Holiday' },
    { name: 'Spring Equinox', date: '2026-03-21', type: 'Studio Holiday' },
    { name: 'Summer Solstice Break', date: '2026-06-21', type: 'Studio Downtime' },
    { name: 'Autumn Labor Holiday', date: '2026-09-07', type: 'Public Holiday' },
    { name: 'Year-End Studio Wrap', date: '2026-12-25', type: 'Company Closure' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Working Hours & Studio Holiday Calendar
          </h3>
          <p className="text-xs text-slate-400">
            Regional operational calendar, shift schedules, and official studio closures for {office.name}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Working Hours */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Standard Shift Hours ({office.timezone})
          </h4>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Core Office Hours:</span>
              <span className="text-white font-bold">{office.working_hours}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Overnight Render Farm Sync:</span>
              <span className="text-indigo-300">22:00 - 06:00 Local</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400">Global Sync Standup:</span>
              <span className="text-emerald-400">10:00 - 10:30 Local</span>
            </div>
          </div>
        </div>

        {/* Holidays */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2">
            <Flag className="w-4 h-4 text-indigo-400" />
            Site Holidays & Studio Closures (2026)
          </h4>

          <div className="space-y-2 text-xs">
            {holidays.map((h) => (
              <div
                key={h.name}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800"
              >
                <div>
                  <span className="font-bold text-white block">{h.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">{h.date}</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono text-slate-300">
                  {h.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
