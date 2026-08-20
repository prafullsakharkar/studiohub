import React from 'react';
import { Server, Monitor, Cpu, HardDrive, Wifi, Tv, Boxes } from 'lucide-react';
import { Office } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

const resourceIcons: Record<string, React.ReactNode> = {
    'Render Farm': <Server className="w-4 h-4 text-amber-400" />,
    'Color Suite': <Tv className="w-4 h-4 text-indigo-400" />,
    'Review Room': <Monitor className="w-4 h-4 text-emerald-400" />,
    'Workstations': <Cpu className="w-4 h-4 text-sky-400" />,
    'Storage': <HardDrive className="w-4 h-4 text-rose-400" />,
    'Network': <Wifi className="w-4 h-4 text-violet-400" />,
};

export const OfficeResourcesTab: React.FC<{ office: Office }> = ({ office }) => {
    const resources = office.resources || [
        'Render Farm',
        'Color Suite',
        'Review Room',
        'Workstations',
        'Storage',
        'Network',
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-indigo-400" />
                        Facility Resources & Infrastructure
                    </h3>
                    <p className="text-xs text-slate-400">
                        Compute, review, and calibration assets available at {office.name}.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((resource) => (
                    <div
                        key={resource}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex items-center gap-3 hover:border-slate-700 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                            {resourceIcons[resource] || <Boxes className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div className="flex-1">
                            <span className="font-bold text-sm text-white block">{resource}</span>
                            <span className="text-xs text-slate-400 font-mono">Operational</span>
                        </div>
                        <Badge variant="success" className="text-[10px] font-mono">
                            Online
                        </Badge>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Network Backbone</span>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Wifi className="w-4 h-4 text-violet-400" />
                    <span className="font-mono">{office.network_speed_gbps} Gbps low-latency sync grid</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Tv className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono">Calibrated to {office.color_space}</span>
                </div>
            </div>
        </div>
    );
};
