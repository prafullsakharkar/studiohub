import React from 'react';
import {
  Building,
  Briefcase,
  Shield,
  DollarSign,
  Film,
  User,
  Mail,
  Phone,
  Globe,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react';
import { Client } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import {
  mockClientContracts,
  mockPurchaseOrders,
  mockClientDeliverables,
  mockClientActivities,
} from '@/mocks/db/organization/clientVendorDetails';
import { useClientContacts } from '../../hooks/useOrganizationData';
import { mockProjects } from '@/mocks/db/production/projects';
import { Link } from 'react-router-dom';

interface ClientOverviewTabProps {
  client: Client;
  onNavigateTab: (tab: string) => void;
  onAddContact: () => void;
  onAddProject: () => void;
}

export const ClientOverviewTab: React.FC<ClientOverviewTabProps> = ({
  client,
  onNavigateTab,
  onAddContact,
  onAddProject,
}) => {
  const { data: contacts = [] } = useClientContacts(client.id);
  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
  const contracts = mockClientContracts.filter((c) => c.client_id === client.id);
  const activeMSA = contracts.find((c) => c.type === 'MSA' && c.status === 'Active');
  const pos = mockPurchaseOrders.filter((p) => p.client_id === client.id);
  const totalPoAmount = pos.reduce((sum, p) => sum + p.amount_usd, 0);
  const deliverables = mockClientDeliverables.filter((d) => d.client_id === client.id);
  const activities = mockClientActivities.filter((a) => a.client_id === client.id);

  // Projects associated with this client
  const associatedProjects = mockProjects.filter((p) =>
    client.active_projects.some(
      (codeOrName) =>
        p.code.toLowerCase() === codeOrName.toLowerCase() ||
        codeOrName.toLowerCase().includes(p.code.toLowerCase()) ||
        p.client_name?.toLowerCase() === client.name.toLowerCase()
    )
  );

  return (
    <div className="space-y-6">
      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Total Billed (Lifetime)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              ${(client.total_billed_usd / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Tier: {client.contract_tier}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Active Productions</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Film className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {client.active_projects.length} Shows
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-indigo-300 font-mono">
              <span>{client.active_projects.join(', ')}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Purchase Orders</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              ${(totalPoAmount / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-purple-300 font-medium">
              <span>{pos.length} Active POs registered</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Review Portal Entitlement</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">
                {client.portal_access ? 'Secured Portal' : 'Access Restricted'}
              </span>
              {client.portal_access && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              Watermarked 4K HDR Sync
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Projects Slate */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  Active Production Slate ({associatedProjects.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Contracted feature films and episodic series with turnover allocations.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={onAddProject} className="text-xs">
                + Link Project
              </Button>
            </div>

            <div className="divide-y divide-slate-800/60 mt-2">
              {associatedProjects.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No active productions linked to this client studio.
                </div>
              ) : (
                associatedProjects.map((proj) => {
                  const percent = Math.round((proj.approved_shots / proj.total_shots) * 100) || 0;
                  return (
                    <div key={proj.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={proj.thumbnail_url}
                          alt={proj.name}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-700/60"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white hover:text-indigo-400 transition-colors">
                              {proj.name}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px] text-indigo-300">
                              {proj.code}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {proj.type}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 font-mono">
                            <span>Sup: {proj.supervisor_name}</span>
                            <span>•</span>
                            <span>Due: {proj.delivery_date}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 min-w-[180px]">
                        <div className="flex-1">
                          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                            <span>Shots: {proj.approved_shots}/{proj.total_shots}</span>
                            <span className="text-emerald-400 font-bold">{percent}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                        <Link
                          to={`/projects`}
                          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                          title="Open Project"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/60 flex justify-end">
              <button
                onClick={() => onNavigateTab('projects')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                View all production details & turnovers →
              </button>
            </div>
          </div>

          {/* Master Deliverables Snapshot */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Recent Studio Deliverables ({deliverables.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Final master EXRs, digital plates, and QuickTime dailies packages.
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('deliverables')}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                All Deliverables →
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {deliverables.slice(0, 3).map((del) => (
                <div
                  key={del.id}
                  className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-medium text-slate-200 truncate">
                      {del.title}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                      <span>[{del.project_code}]</span>
                      <span>•</span>
                      <span>{del.package_type}</span>
                      <span>•</span>
                      <span>{del.resolution}</span>
                      <span>•</span>
                      <span>{del.file_size_gb} GB</span>
                    </div>
                  </div>
                  <Badge
                    variant={del.status.includes('Accepted') ? 'success' : 'secondary'}
                    className="shrink-0 text-[10px]"
                  >
                    {del.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 1 Col */}
        <div className="space-y-6">
          {/* Executive Contact Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Primary Executive Liaison
              </h3>
              <Button size="sm" variant="ghost" onClick={onAddContact} className="text-xs text-indigo-400">
                + Contact
              </Button>
            </div>

            {primaryContact ? (
              <div className="mt-4 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
                    {primaryContact.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">{primaryContact.name}</div>
                    <div className="text-xs text-indigo-300 font-medium">{primaryContact.role}</div>
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

                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateTab('contacts')}
                    className="w-full text-xs"
                  >
                    View All Studio Contacts ({contacts.length})
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                No contact configured.
              </div>
            )}
          </div>

          {/* Master Contract & Security Status */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3.5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono pb-2 border-b border-slate-800">
              Contract & Compliance
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Headquarters</span>
                <span className="font-medium text-slate-200">{client.headquarters}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Master Service Agreement</span>
                <span className="font-mono text-emerald-400 font-medium">
                  {activeMSA ? activeMSA.contract_number : 'Active Framework'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Studio Security Classification</span>
                <Badge variant="outline" className="font-mono text-[10px] text-amber-300 border-amber-500/30">
                  Tier 1 Enterprise
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Client Portal SSO</span>
                <span className="font-mono text-slate-300">Enforced (Okta / SAML)</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigateTab('contracts')}
              className="w-full text-xs mt-2"
            >
              Review Master Contracts →
            </Button>
          </div>

          {/* Recent Activity Mini-Feed */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Activity
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
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
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
