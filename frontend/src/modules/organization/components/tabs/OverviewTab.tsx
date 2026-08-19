import React from 'react';
import {
  Building2,
  Globe,
  HardDrive,
  Users,
  Film,
  Activity,
  Server,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Organization } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const OverviewTab: React.FC<{ org: Organization; onSwitchTab: (tab: string) => void }> = ({
  org,
  onSwitchTab,
}) => {
  const storagePercentage = Math.min(100, Math.round((org.storage_used_tb / org.storage_quota_tb) * 100));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Production Shows</span>
            <Film className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{org.active_projects_count}</div>
          <button
            onClick={() => onSwitchTab('projects')}
            className="text-[11px] text-indigo-400 hover:underline mt-2 flex items-center gap-1 font-medium"
          >
            <span>View all projects</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Studio Crew Size</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{org.crew_count}</div>
          <button
            onClick={() => onSwitchTab('people')}
            className="text-[11px] text-emerald-400 hover:underline mt-2 flex items-center gap-1 font-medium"
          >
            <span>Crew roster</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Global Facilities</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{org.offices_count}</div>
          <button
            onClick={() => onSwitchTab('offices')}
            className="text-[11px] text-cyan-400 hover:underline mt-2 flex items-center gap-1 font-medium"
          >
            <span>Manage offices</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Storage Allocated</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{org.storage_used_tb} TB</div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            {storagePercentage}% of {org.storage_quota_tb} TB Quota
          </div>
        </div>
      </div>

      {/* Grid of Studio Vitals & Pipeline Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Studio Pipeline & Environment Profile */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Pipeline Core & Tenancy Specifications
            </h3>
            <Badge variant="outline" className="font-mono text-[10px] text-indigo-300 border-indigo-500/30">
              {org.settings?.usd_schema_version || 'OpenUSD 24.08'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Default FPS & Timing</span>
              <div className="font-bold text-white font-mono">{org.settings?.default_fps || 24} FPS</div>
              <p className="text-[11px] text-slate-400">SMPTE timecode sync standard across editorial.</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">OCIO Working Color Space</span>
              <div className="font-bold text-white font-mono text-emerald-400">
                {org.settings?.default_color_space || 'ACEScg / ACES 1.3'}
              </div>
              <p className="text-[11px] text-slate-400">Standardized Academy color encoding system.</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Default Show Resolution</span>
              <div className="font-bold text-white font-mono">{org.settings?.default_resolution || '4096x2160'}</div>
              <p className="text-[11px] text-slate-400">Native master plate raster resolution.</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400">Render Farm Compute Hub</span>
              <div className="font-bold text-white font-mono text-indigo-300">
                {org.settings?.render_farm_region || 'Dedicated Cloud Burst'}
              </div>
              <p className="text-[11px] text-slate-400">Low-latency fiber interconnect.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-white">Security & Multi-Tenant Boundary</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All shot databases, published OpenUSD layers, daily annotations, and asset catalogs are isolated within
                tenancy boundary <strong className="text-indigo-300 font-mono">[{org.code}]</strong>. SSO & MFA are{' '}
                {org.settings?.sso_enforced ? 'enforced' : 'optional'}.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions & Facility Breakdown */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-3">Facility Hubs & Disciplines</h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Headquarters</span>
                <span className="font-medium text-white">{org.headquarters}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Supervising Contact</span>
                <span className="font-medium text-white">{org.primary_contact_name}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Organization Status</span>
                <Badge variant={org.status === 'Active' ? 'success' : 'neutral'} className="text-[9px] font-mono">
                  {org.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Subscription Tier</span>
                <span className="font-medium text-indigo-300">{org.tier}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-center text-xs"
              onClick={() => onSwitchTab('projects')}
            >
              Open Production Dashboard
            </Button>
            <Link to={`/organizations/${org.id}/edit`} className="block">
              <Button size="sm" variant="secondary" className="w-full justify-center text-xs">
                Edit Studio Specifications
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
