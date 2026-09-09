import React from 'react';
import { Building2, MapPin, Globe, Users, Clock, Calendar, CheckCircle2, Shield } from 'lucide-react';
import { OfficeEntity } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const OfficeOverviewTab: React.FC<{ office: OfficeEntity }> = ({ office }) => {
  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Stationed Crew</span>
          <div className="flex items-center gap-2 mt-1">
            <Users className="w-5 h-5 text-indigo-400" />
            <span className="text-2xl font-bold font-mono text-white">{office.headcount}</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Full-time artists & leads</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Timezone</span>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span className="text-lg font-bold font-mono text-white truncate">{office.timezone}</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block font-mono">{office.working_hours}</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Workstations</span>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span className="text-2xl font-bold font-mono text-white">{office.workstations_count || 120}</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Dual-GPU artist seats</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Render Nodes</span>
          <div className="flex items-center gap-2 mt-1">
            <Shield className="w-5 h-5 text-amber-400" />
            <span className="text-2xl font-bold font-mono text-white">{office.render_nodes_count || 320}</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Local render blades</span>
        </div>
      </div>

      {/* Details Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-indigo-400" />
            Studio Location & Facility Details
          </h3>
          <Badge variant={office.is_active ? 'success' : 'outline'} className="text-[10px] font-mono">
            {office.is_active ? 'Operational Hub' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Physical Address</span>
            <span className="text-xs text-slate-300 block mt-1">{office.address}</span>
            <span className="text-xs text-slate-400 font-mono">{office.city}, {office.country}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Facility General Manager</span>
            <span className="text-xs font-bold text-white block mt-1">{office.manager_name}</span>
            <span className="text-xs text-slate-400 font-mono">Site Operations Director</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Screening Room / DI Theater</span>
            <span className="text-xs text-emerald-400 font-mono block mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 4K DCI-P3 Color Calibrated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
