import React from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Briefcase,
  Building,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  Layers,
  Award,
  Palette,
} from 'lucide-react';
import { Person } from '@/types/masterData';
import { Badge } from '@/shared/components/Badge';
import { Link } from 'react-router-dom';

export const PersonOverviewTab: React.FC<{ person: Person }> = ({ person }) => {
  return (
    <div className="space-y-6">
      {/* Bio / Summary Banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SmartImg
            src={person.avatar_url}
            alt={person.full_name}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-indigo-500/50 shadow-md shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{person.full_name}</h2>
              <Badge variant="outline" className="font-mono text-[10px] text-indigo-300 border-indigo-500/30">
                {person.seniority}
              </Badge>
              <Badge
                variant={person.status === 'Active' || !person.status ? 'success' : person.status === 'Suspended' ? 'error' : 'warning'}
                className="font-mono text-[10px]"
              >
                {person.status || 'Active'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{person.role} • {person.department_name}</p>
            <div className="flex items-center gap-3 text-slate-400 text-xs mt-2">
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> {person.email}
              </span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> {person.office_name}
              </span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> {person.timezone}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
          <div className="text-center px-3 border-r border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Tasks</span>
            <span className="text-lg font-bold font-mono text-indigo-400">{person.active_tasks}</span>
          </div>
          <div className="text-center px-3 border-r border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Logged Hours</span>
            <span className="text-lg font-bold font-mono text-emerald-400">{person.logged_hours}h</span>
          </div>
          <div className="text-center px-3">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Clearance</span>
            <span className="text-xs font-bold font-mono text-amber-400">{person.security_clearance || 'MPAA Tier 3'}</span>
          </div>
        </div>
      </div>

      {/* Grid of Key Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Core Relationships */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5" /> Department & Squad Alignment
          </h3>
          <div className="divide-y divide-slate-800/80 text-xs">
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Department</span>
              <span className="font-semibold text-white">{person.department_name}</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Primary Team Squad</span>
              <span className="font-semibold text-indigo-300">{person.team_name || 'Alpha Strike Squad'}</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Assigned Facility</span>
              <span className="font-semibold text-white">{person.office_name}</span>
            </div>
            <div className="py-2 flex items-center justify-between">
              <span className="text-slate-400">Availability State</span>
              <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/30">
                {person.availability_status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Primary Toolchain & Skills */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Core Disciplines & Software
          </h3>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {person.skills.map((skill) => (
              <span
                key={skill}
                className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Assigned Shows</span>
            <div className="flex flex-wrap gap-1.5">
              {(person.assigned_projects || ['NK99', 'CR88']).map((proj) => (
                <span
                  key={proj}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40 text-indigo-300"
                >
                  {proj}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Theme & Accent Configuration Summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              User Theme & Accent Preferences
              <span className="text-[10px] font-mono font-normal text-slate-400">
                (Profile Settings)
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize your personal cyan & blue studio accent spectrum and synchronize across sessions.
            </p>
          </div>
        </div>

        <Link
          to="/platform/admin/theme"
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Open Theme Editor</span>
        </Link>
      </div>
    </div>
  );
};
