import React from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { WorkspaceOpenButton } from '@/shared/workspace/canonical/WorkspaceButtons';
import {
  Film,
  Building,
  Layers,
  User,
  Users,
  Briefcase,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  MapPin,
  Flame,
  Clapperboard,
  Box,
  CheckSquare,
  Shield,
  Activity,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';
import { SensitiveField } from '@/core/permissions/components/SensitiveField';
import { FieldPermissionGate } from '@/core/permissions/components/FieldPermissionGate';

// REST-only shim: mock engine removed; backend is the source of truth.
import type { Project } from '@/types/production';
const clientsFallback: any[] = [];
const clientContactsFallback: any[] = [];
const vendorsFallback: any[] = [];
const projectMilestonesFallback: any[] = [];
const projectCrewFallback: any[] = [];
const projectActivitiesFallback: any[] = [];

interface ProjectOverviewTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({
  project,
  onNavigateTab,
}) => {
  const completionPct =
    project.total_shots > 0 ? Math.round((project.approved_shots / project.total_shots) * 100) : 0;

  // Resolved entities
  const client = clientsFallback.find((c) => c.id === project.client_id || c.name === project.client_name);
  const clientContact = clientContactsFallback.find(
    (cc) => cc.id === project.client_contact_id || cc.name === project.client_contact_name
  );

  const vendors = vendorsFallback.filter(
    (v) =>
      project.vendor_ids?.includes(v.id) ||
      project.vendor_names?.some((vn) => v.name.toLowerCase().includes(vn.toLowerCase()) || vn.toLowerCase().includes(v.name.toLowerCase()))
  );

  const milestones = projectMilestonesFallback.filter((m) => m.project_id === project.id);
  const displayMilestones = milestones.length > 0 ? milestones : projectMilestonesFallback;

  const crew = projectCrewFallback.filter((c) => c.project_id === project.id);
  const displayCrew = crew.length > 0 ? crew : projectCrewFallback;

  const activities = projectActivitiesFallback.filter((a) => a.project_id === project.id);
  const displayActivities = activities.length > 0 ? activities : projectActivitiesFallback;

  return (
    <div className="space-y-6">
      {/* Metric Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Shot Progression</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {project.approved_shots} / {project.total_shots}
              </span>
              <span className="text-xs font-mono text-indigo-400 font-bold">({completionPct}%)</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-800">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Production Budget</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <SensitiveField
              entityType="project"
              field="budget"
              value={`$${(project.budget_usd / 1000000).toFixed(2)}M USD`}
              maskPlaceholder="[RESTRICTED_BUDGET]"
              context={{ projectId: project.id, organizationId: project.organization_id }}
              className="text-2xl font-bold font-mono text-white"
            />
            <FieldPermissionGate
              entityType="project"
              field="budget"
              context={{ projectId: project.id, organizationId: project.organization_id }}
              fallback={<div className="text-[11px] text-zinc-500 font-mono mt-1">Financial metrics restricted</div>}
            >
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-mono">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Burn Rate: On Track (68% Disbursed)</span>
              </div>
            </FieldPermissionGate>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">OpenUSD Digital Assets</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {project.total_assets} Hero Assets
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-purple-400 font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MaterialX ACEScg LookDev</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Master Delivery Target</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold font-mono text-white">
              {project.delivery_date}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-400 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>{project.fps} FPS @ {project.resolution}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Project Overview, Scope, Milestones, Relationships */}
        <div className="lg:col-span-2 space-y-6">
          {/* Production Synopsis & Brief */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  Production Synopsis & Technical Envelope
                </h3>
              </div>
              <span className="text-xs font-mono text-indigo-300 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                {project.type}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {project.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Color Space</span>
                <span className="font-bold text-indigo-400 mt-0.5 block truncate">{project.color_space}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Resolution</span>
                <span className="font-bold text-slate-200 mt-0.5 block truncate">{project.resolution}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Frame Rate</span>
                <span className="font-bold text-slate-200 mt-0.5 block">{project.fps} FPS</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Aspect Ratio</span>
                <span className="font-bold text-slate-200 mt-0.5 block">{project.aspect_ratio || '2.39:1'}</span>
              </div>
            </div>
          </div>

          {/* Client & Vendor Relationships */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Studio Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    Client Studio Entity
                  </span>
                  {project.client_id && (
                    <WorkspaceOpenButton
                      to={`/clients/${project.client_id}`}
                      title="Open Client Workspace"
                    />
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">{project.client_name}</h4>
                    {client && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{client.studio_type} • {client.headquarters}</p>
                    )}
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Client Contact Liaison</span>
                    <span className="font-bold text-slate-200">{project.client_contact_name || clientContact?.name || 'Assigned Client Rep'}</span>
                    {clientContact?.role && (
                      <span className="text-[10px] text-slate-400 block truncate">{clientContact.role}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Security Tier: <strong className="text-slate-300">{client?.contract_tier || 'Tier 1 Strategic'}</strong></span>
                <span className="text-emerald-400 font-mono text-[10px]">● Portal Connected</span>
              </div>
            </div>

            {/* Contracted Outsourcing Vendors */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Outsourcing Partners ({vendors.length || project.vendor_names?.length || 0})
                  </span>
                  <Link
                    to="/vendors"
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono font-medium"
                  >
                    Directory <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="mt-3 space-y-2">
                  {vendors.length > 0 ? (
                    vendors.map((ven) => (
                      <div
                        key={ven.id}
                        className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{ven.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                              {ven.specialization}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{ven.location}</span>
                        </div>
                        <WorkspaceOpenButton
                          to={`/vendors/${ven.id}`}
                          title="Open Vendor Workspace"
                        />
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg">
                      No contracted outsourcing partners linked to this show.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Security Protocol: <strong className="text-slate-300">MPAA CDSA Tier 4</strong></span>
              </div>
            </div>
          </div>

          {/* Schedule Milestones Roadmap */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                  Production Milestone Schedule
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('schedule')}
                className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                Full Roadmap →
              </button>
            </div>

            <div className="space-y-3">
              {displayMilestones.map((ms, idx) => (
                <div
                  key={ms.id}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 ${
                        ms.status === 'Completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : ms.status === 'In Progress'
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{ms.title}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-800">
                          {ms.phase}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{ms.notes}</p>
                    </div>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 shrink-0 font-mono text-xs">
                    <span className="text-slate-300 font-bold">{ms.due_date}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        ms.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : ms.status === 'In Progress'
                          ? 'bg-indigo-500/10 text-indigo-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ms.status} ({ms.progress_pct}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Key Personnel, Participating Teams & Offices, Recent Activity */}
        <div className="space-y-6">
          {/* Key Production Leadership & Team Members */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Show Leadership & Crew
              </span>
              <button
                onClick={() => onNavigateTab('resources')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-mono"
              >
                Crew Matrix →
              </button>
            </div>

            <div className="space-y-3">
              {displayCrew.slice(0, 4).map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <SmartImg
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{member.name}</h4>
                      <p className="text-[10px] font-mono text-indigo-300 truncate">{member.role}</p>
                      <span className="text-[9px] text-slate-500 block truncate">{member.department}</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 shrink-0">
                    {member.allocation_pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Teams, Departments & Multi-Site Offices */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Studio Operations & Locations
            </span>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Main Production Stage</span>
                <span className="font-bold text-white">Montreal HQ (Main Stage)</span>
                <span className="text-[10px] text-slate-400 block">Render Farm: Dedicated 12,000 Cores</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Secondary Unit Site</span>
                <span className="font-bold text-white">London Site (West End)</span>
                <span className="text-[10px] text-slate-400 block">LookDev & Lighting Lead Wing</span>
              </div>
            </div>
          </div>

          {/* Recent Show Activity Stream */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Live Production Activity
              </span>
              <button
                onClick={() => onNavigateTab('activity')}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-mono"
              >
                View All →
              </button>
            </div>

            <div className="space-y-3">
              {displayActivities.slice(0, 3).map((act) => (
                <div key={act.id} className="text-xs space-y-1 pb-2 border-b border-slate-800/60 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span className="font-bold text-slate-300">{act.user_name}</span>
                    <span>{act.timestamp}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-snug">
                    <span className="text-indigo-400 font-mono font-bold mr-1">{act.target_code}</span>
                    {act.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
