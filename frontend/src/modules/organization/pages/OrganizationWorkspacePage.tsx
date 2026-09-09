import React, { useState } from 'react';
import {
  Building2,
  Globe,
  HardDrive,
  Users,
  Film,
  Activity,
  Layers,
  Palette,
  Sliders,
  ShieldCheck,
  UserCheck,
  Building,
  Cpu,
  ArrowLeft,
  Edit,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useOrganizationDetail } from '../hooks/useOrganizations';
import { useOrganization } from '@/core/organization/useOrganization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';

// Tab Components
import { OverviewTab } from '../components/tabs/OverviewTab';
import { ProfileTab } from '../components/tabs/ProfileTab';
import { BrandingTab } from '../components/tabs/BrandingTab';
import { OfficesTab } from '../components/tabs/OfficesTab';
import { DepartmentsTab } from '../components/tabs/DepartmentsTab';
import { TeamsTab } from '../components/tabs/TeamsTab';
import { PeopleTab } from '../components/tabs/PeopleTab';
import { ClientsTab } from '../components/tabs/ClientsTab';
import { VendorsTab } from '../components/tabs/VendorsTab';
import { ProjectsTab } from '../components/tabs/ProjectsTab';
import { SettingsTab } from '../components/tabs/SettingsTab';
import { ActivityTab } from '../components/tabs/ActivityTab';

export type OrgWorkspaceTabId =
  | 'overview'
  | 'profile'
  | 'branding'
  | 'offices'
  | 'departments'
  | 'teams'
  | 'people'
  | 'clients'
  | 'vendors'
  | 'projects'
  | 'settings'
  | 'activity';

interface TabDefinition {
  id: OrgWorkspaceTabId;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview', icon: Building2 },
  { id: 'profile', label: 'Profile', icon: UserCheck },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'offices', label: 'Offices', icon: Globe },
  { id: 'departments', label: 'Departments', icon: Layers },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'people', label: 'People', icon: Users },
  { id: 'clients', label: 'Clients', icon: Building },
  { id: 'vendors', label: 'Vendors', icon: Cpu },
  { id: 'projects', label: 'Projects', icon: Film },
  { id: 'settings', label: 'Settings', icon: Sliders },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export const OrganizationWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as OrgWorkspaceTabId) || 'overview';

  const { data: org, isLoading, refetch } = useOrganizationDetail(id);
  const { currentOrganization, switchOrganization } = useOrganization();

  const handleTabChange = (tabId: OrgWorkspaceTabId | string) => {
    setSearchParams({ tab: tabId });
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-xs text-slate-400 font-mono">
        Loading studio tenancy workspace...
      </div>
    );
  }

  if (!org) {
    return (
      <div className="p-16 text-center text-xs text-rose-400 font-mono space-y-3">
        <div>Studio Organization "{id}" not found.</div>
        <Link to="/organizations">
          <Button size="xs" variant="outline">
            Return to Organizations Directory
          </Button>
        </Link>
      </div>
    );
  }

  const isCurrentTenant = org.id === currentOrganization.id;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-200">
      {/* Top Banner & Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md">
        {/* Banner Image */}
        <div className="h-32 w-full relative bg-slate-950 overflow-hidden">
          {org.banner_url ? (
            <img src={org.banner_url} alt="" className="w-full h-full object-cover opacity-40" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          <div className="absolute top-3 left-4">
            <Link to="/organizations">
              <Button
                size="xs"
                variant="outline"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                className="bg-slate-950/80 backdrop-blur-xs border-slate-800"
              >
                All Organizations
              </Button>
            </Link>
          </div>
        </div>

        {/* Identity & Actions Bar */}
        <div className="p-5 relative -mt-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-end gap-4">
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-900 bg-slate-950 shadow-2xl shrink-0"
            />
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">{org.name}</h1>
                <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                  {org.code}
                </span>
                <Badge
                  variant={org.status === 'Active' ? 'success' : 'neutral'}
                  className="text-[10px] uppercase font-mono"
                >
                  {org.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>{org.headquarters}</span>
                <span>•</span>
                <span className="text-indigo-400 font-sans">{org.tier}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isCurrentTenant ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => switchOrganization(org.id)}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Switch to this Tenant
              </Button>
            ) : (
              <span className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                Active Studio Context
              </span>
            )}

            <Link to={`/organizations/${org.id}/edit`}>
              <Button size="sm" variant="secondary" leftIcon={<Edit className="w-3.5 h-3.5" />}>
                Edit Profile
              </Button>
            </Link>
          </div>
        </div>

        {/* 12 Horizontal Workspace Tabs Bar */}
        <div className="px-5 border-t border-slate-800/80 bg-slate-950/60 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1 py-1.5 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap',
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workspace Active Tab View */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && <OverviewTab org={org} onSwitchTab={handleTabChange} />}
        {activeTab === 'profile' && <ProfileTab org={org} />}
        {activeTab === 'branding' && <BrandingTab org={org} />}
        {activeTab === 'offices' && <OfficesTab org={org} />}
        {activeTab === 'departments' && <DepartmentsTab org={org} />}
        {activeTab === 'teams' && <TeamsTab org={org} />}
        {activeTab === 'people' && <PeopleTab org={org} />}
        {activeTab === 'clients' && <ClientsTab org={org} />}
        {activeTab === 'vendors' && <VendorsTab org={org} />}
        {activeTab === 'projects' && <ProjectsTab org={org} />}
        {activeTab === 'settings' && <SettingsTab org={org} />}
        {activeTab === 'activity' && <ActivityTab org={org} />}
      </div>
    </div>
  );
};
