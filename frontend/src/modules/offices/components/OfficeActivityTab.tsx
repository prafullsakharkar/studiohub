import React from 'react';
import { Activity } from 'lucide-react';
import { Office } from '@/types/organization';

export const OfficeActivityTab: React.FC<{ office: Office }> = ({ office }) => {
    const events = [
        {
            id: 'oact-1',
            title: 'Render Farm Capacity Expanded',
            time: '2 hours ago',
            details: `Added 40 nodes to the ${office.name} render farm to support NK99 sequence 020.`,
        },
        {
            id: 'oact-2',
            title: 'Color Suite Recalibrated',
            time: '1 day ago',
            details: `All grading suites recalibrated to ${office.color_space} reference standard.`,
        },
        {
            id: 'oact-3',
            title: 'Facility Lead Rotation Completed',
            time: '3 days ago',
            details: `${office.manager_name} assumed facility management responsibilities for ${office.name}.`,
        },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        Facility Audit Log
                    </h3>
                    <p className="text-xs text-slate-400">
                        Log of infrastructure changes, calibrations, and facility management events.
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
