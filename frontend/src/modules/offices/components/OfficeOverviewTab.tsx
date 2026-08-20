import React from 'react';
import { MapPin, Globe, Users, Zap, Tv, Clock, ShieldCheck } from 'lucide-react';
import { Office } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const OfficeOverviewTab: React.FC<{ office: Office }> = ({ office }) => {
    const occupancyRate = Math.round((office.current_occupancy / office.capacity) * 100);

    return (
        <div className="space-y-6">
            {/* Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center font-mono font-bold text-xl text-white shadow-md ring-2 ring-indigo-500/30 bg-indigo-600">
                        {office.code}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">{office.name}</h2>
                            <Badge variant="outline" className="font-mono text-[10px] text-indigo-300">
                                {office.code}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 max-w-xl">
                            {office.city}, {office.country} • {office.address}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                    <div className="text-center px-3 border-r border-slate-800">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Occupancy</span>
                        <span className="text-lg font-bold font-mono text-indigo-400">{occupancyRate}%</span>
                    </div>
                    <div className="text-center px-3 border-r border-slate-800">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Seats</span>
                        <span className="text-lg font-bold font-mono text-emerald-400">{office.current_occupancy}/{office.capacity}</span>
                    </div>
                    <div className="text-center px-3">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Status</span>
                        <span className="text-lg font-bold font-mono text-amber-400">{office.status}</span>
                    </div>
                </div>
            </div>

            {/* Grid of Key Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Facility Leadership */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                    <h3 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Facility Leadership
                    </h3>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-600/20 text-indigo-300 font-bold text-sm">
                            {office.manager_name.charAt(0)}
                        </div>
                        <div>
                            <span className="font-bold text-sm text-white block">{office.manager_name}</span>
                            <span className="text-xs text-slate-400 font-mono">Facility Manager</span>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-800/80 text-xs pt-1">
                        <div className="py-2 flex items-center justify-between">
                            <span className="text-slate-400">Facility Identifier</span>
                            <span className="font-mono text-white">{office.id}</span>
                        </div>
                        <div className="py-2 flex items-center justify-between">
                            <span className="text-slate-400">Timezone</span>
                            <span className="text-indigo-300 font-mono">{office.timezone}</span>
                        </div>
                    </div>
                </div>

                {/* Infrastructure */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                    <h3 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" /> Infrastructure & Calibration
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-400" /> Network
                            </span>
                            <span className="text-sm font-bold text-white font-mono mt-0.5 block">{office.network_speed_gbps} Gbps</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                <Tv className="w-3 h-3 text-indigo-400" /> Color Space
                            </span>
                            <span className="text-sm font-bold text-white font-mono mt-0.5 block truncate">{office.color_space}</span>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-2">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Assigned Active Shows</span>
                        <div className="flex flex-wrap gap-1.5">
                            {(office.assigned_projects || []).map((proj) => (
                                <span
                                    key={proj}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40 text-indigo-300"
                                >
                                    {proj}
                                </span>
                            ))}
                            {(office.assigned_projects || []).length === 0 && (
                                <span className="text-[11px] font-mono text-slate-500">No shows assigned</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
