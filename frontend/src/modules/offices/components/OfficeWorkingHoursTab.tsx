import React from 'react';
import { Clock, Sunrise, Sunset, Coffee } from 'lucide-react';
import { Office } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const OfficeWorkingHoursTab: React.FC<{ office: Office }> = ({ office }) => {
    const workingHours = office.working_hours || '09:00 - 18:00 (Mon-Fri)';

    const shifts = [
        { name: 'Morning Shift', hours: '09:00 - 13:00', icon: Sunrise, color: 'text-amber-400' },
        { name: 'Afternoon Shift', hours: '13:00 - 18:00', icon: Coffee, color: 'text-indigo-400' },
        { name: 'Night / Render Shift', hours: '18:00 - 02:00', icon: Sunset, color: 'text-violet-400' },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        Working Hours & Shift Schedule
                    </h3>
                    <p className="text-xs text-slate-400">
                        Standard operating hours and shift windows at {office.name} ({office.timezone}).
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between">
                <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Standard Hours</span>
                    <span className="text-lg font-bold font-mono text-white mt-1 block">{workingHours}</span>
                </div>
                <Badge variant="success" className="text-[10px] font-mono">
                    Active
                </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {shifts.map((shift) => {
                    const Icon = shift.icon;
                    return (
                        <div
                            key={shift.name}
                            className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3 hover:border-slate-700 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${shift.color}`} />
                                <span className="font-bold text-sm text-white">{shift.name}</span>
                            </div>
                            <span className="text-xs font-mono text-slate-300 block">{shift.hours}</span>
                            <span className="text-[10px] font-mono text-slate-500 block">Local time at facility</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
