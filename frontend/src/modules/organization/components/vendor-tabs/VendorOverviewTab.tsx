import React from 'react';
import {
  Shield,
  Layers,
  Users,
  Film,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
  TrendingUp,
  Mail,
  Phone,
  Globe,
  HardDrive,
  FileText,
  Percent,
} from 'lucide-react';
import { Vendor } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import {
  mockVendorContacts,
  mockVendorUsers,
  mockVendorTeams,
  mockVendorDeliveries,
  mockVendorPerformanceMap,
  mockVendorActivities,
} from '@/mocks/db/organization/clientVendorDetails';
import { mockProjects } from '@/mocks/db/production/projects';

interface VendorOverviewTabProps {
  vendor: Vendor;
  onNavigateTab: (tab: string) => void;
  onAddUser: () => void;
  onAddProject: () => void;
  onAssignTeam: () => void;
}

export const VendorOverviewTab: React.FC<VendorOverviewTabProps> = ({
  vendor,
  onNavigateTab,
  onAddUser,
  onAddProject,
  onAssignTeam,
}) => {
  const contacts = mockVendorContacts.filter((c) => c.vendor_id === vendor.id);
  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
  const users = mockVendorUsers.filter((u) => u.vendor_id === vendor.id);
  const teams = mockVendorTeams.filter((t) => t.vendor_id === vendor.id);
  const deliveries = mockVendorDeliveries.filter((d) => d.vendor_id === vendor.id);
  const performance = mockVendorPerformanceMap[vendor.id] || {
    vendor_id: vendor.id,
    on_time_delivery_rate: 96.0,
    qc_first_pass_rate: 92.0,
    avg_turnaround_hours: 36,
    total_shots_completed: 350,
    rating: 4.8,
    sla_compliance_rate: 98.0,
  };
  const activities = mockVendorActivities.filter((a) => a.vendor_id === vendor.id);

  // Associated Projects
  const associatedProjects = mockProjects.filter((p) =>
    vendor.active_projects.some(
      (codeOrName) =>
        p.code.toLowerCase() === codeOrName.toLowerCase() ||
        codeOrName.toLowerCase().includes(p.code.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">On-Time Delivery Rate</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {performance.on_time_delivery_rate}%
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              SLA Compliance: {performance.sla_compliance_rate}%
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">QC First-Pass Rate</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {performance.qc_first_pass_rate}%
            </div>
            <div className="text-[11px] text-indigo-300 font-mono mt-1">
              Avg Turnaround: {performance.avg_turnaround_hours} hrs
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Active Outsourced Tasks</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {vendor.active_tasks_count} Tasks
            </div>
            <div className="text-[11px] text-purple-300 font-mono mt-1">
              {teams.length} Dedicated Squads
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Partner Quality Score</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-400">
              {vendor.rating} / 5.0
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              {performance.total_shots_completed} Total Shots Delivered
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Production Assignments */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  Contracted Productions Slate ({associatedProjects.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Shows with active turnover packages, rotoscope matting, or clean plate scopes.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={onAddProject} className="text-xs">
                + Link Show
              </Button>
            </div>

            <div className="divide-y divide-slate-800/60 mt-2">
              {associatedProjects.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No active productions contracted to this vendor partner.
                </div>
              ) : (
                associatedProjects.map((proj) => (
                  <div key={proj.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={proj.thumbnail_url}
                        alt={proj.name}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-700/60"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">{proj.name}</span>
                          <Badge variant="outline" className="font-mono text-[10px] text-indigo-300">
                            {proj.code}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center gap-3">
                          <span>Supervisor: {proj.supervisor_name}</span>
                          <span>•</span>
                          <span>Due: {proj.delivery_date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onAssignTeam}
                        className="text-xs"
                      >
                        Assign Squad
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
              <button
                onClick={() => onNavigateTab('projects')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                View all vendor production scopes →
              </button>
            </div>
          </div>

          {/* Dedicated Vendor Squads */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Dedicated Vendor Squads & Teams ({teams.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Organized artist units assigned to specific sequence turnovers and shots.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={onAssignTeam} className="text-xs">
                + Assign Team
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col justify-between space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {team.name}
                        <Badge variant="outline" className="font-mono text-[9px] text-indigo-300">
                          {team.code}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {team.focus_discipline}
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {team.current_project_code}
                    </Badge>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span>Lead: {team.lead_name}</span>
                    <span className="text-indigo-300">{team.member_count} Artists</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col) */}
        <div className="space-y-6">
          {/* Facility Contact */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Facility Lead Contact
              </h3>
              <button
                onClick={() => onNavigateTab('contacts')}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                All Contacts →
              </button>
            </div>

            {primaryContact && (
              <div className="mt-4 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm">
                    {primaryContact.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">{primaryContact.name}</div>
                    <div className="text-xs text-purple-300 font-medium">{primaryContact.role}</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-300 font-mono pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`mailto:${primaryContact.email}`} className="hover:text-white truncate">
                      {primaryContact.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{primaryContact.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>{primaryContact.timezone}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Security & Pipeline Specs */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-slate-800">
              Security & Pipeline Ingest
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Security Accreditation</span>
                <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30">
                  {vendor.security_tier}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Optical Pipe Bandwidth</span>
                <span className="font-mono text-cyan-300 font-bold">{vendor.bandwidth_link}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">NDA Binding</span>
                <span className="font-mono text-emerald-400">Signed & Validated</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Facility Location</span>
                <span className="text-slate-200">{vendor.location}</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateTab('performance')}
              className="w-full text-xs mt-2"
            >
              View Full Performance Scorecard →
            </Button>
          </div>

          {/* Recent Vendor Activity */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Ingest & QC Logs
              </h3>
              <button
                onClick={() => onNavigateTab('activity')}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Log →
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {activities.slice(0, 3).map((act) => (
                <div key={act.id} className="text-xs flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-200">{act.action}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                      {act.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
