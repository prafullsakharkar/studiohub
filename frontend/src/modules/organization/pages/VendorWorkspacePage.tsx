import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  Edit,
  Archive,
  RotateCcw,
  Download,
  Shield,
  Layers,
  Users,
  Film,
  FileText,
  PackageCheck,
  Award,
  Activity,
  UserCheck,
  HardDrive,
  Globe,
  Plus,
} from 'lucide-react';
import { useVendors, useVendorMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';

// Tab subcomponents
import { VendorOverviewTab } from '../components/vendor-tabs/VendorOverviewTab';
import { VendorContactsTab } from '../components/vendor-tabs/VendorContactsTab';
import { VendorUsersTab } from '../components/vendor-tabs/VendorUsersTab';
import { VendorDepartmentsTab } from '../components/vendor-tabs/VendorDepartmentsTab';
import { VendorTeamsTab } from '../components/vendor-tabs/VendorTeamsTab';
import { VendorProjectsTab } from '../components/vendor-tabs/VendorProjectsTab';
import { VendorContractsTab } from '../components/vendor-tabs/VendorContractsTab';
import { VendorDeliveriesTab } from '../components/vendor-tabs/VendorDeliveriesTab';
import { VendorPerformanceTab } from '../components/vendor-tabs/VendorPerformanceTab';
import { VendorActivityTab } from '../components/vendor-tabs/VendorActivityTab';

export const VendorWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: vendorsData, isLoading } = useVendors();
  const { archiveVendor, restoreVendor } = useVendorMutations();

  const vendor = vendorsData?.results?.find((v) => v.id === id);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs font-mono text-slate-400">
        Loading vendor partner workspace...
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-sm font-bold text-white">Vendor Partner Not Found</div>
        <p className="text-xs text-slate-400">The requested vendor ID does not exist.</p>
        <Link to="/vendors">
          <Button variant="outline" size="sm">
            ← Return to Vendors
          </Button>
        </Link>
      </div>
    );
  }

  const isArchived = vendor.status === 'Archived';

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(vendor, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vendor_${vendor.code}_record.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'users', label: 'Users & Artists', icon: UserCheck },
    { id: 'departments', label: 'Departments', icon: Layers },
    { id: 'teams', label: 'Teams & Squads', icon: Users },
    { id: 'projects', label: 'Shows / Projects', icon: Film },
    { id: 'contracts', label: 'Contracts & Rates', icon: FileText },
    { id: 'deliveries', label: 'Deliveries & Ingest', icon: PackageCheck },
    { id: 'performance', label: 'Performance Scorecard', icon: Award },
    { id: 'activity', label: 'Activity Trail', icon: Activity },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back Link & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/vendors"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Vendor Partners
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Record
          </Button>

          <Link to={`/vendors/${vendor.id}/edit`}>
            <Button size="sm" variant="outline" className="text-xs flex items-center gap-1.5">
              <Edit className="w-3.5 h-3.5" />
              Edit Profile
            </Button>
          </Link>

          <Button
            size="sm"
            variant={isArchived ? 'primary' : 'outline'}
            onClick={() => {
              if (isArchived) {
                restoreVendor.mutate(vendor.id);
              } else {
                archiveVendor.mutate(vendor.id);
              }
            }}
            className={cn(
              'text-xs flex items-center gap-1.5',
              !isArchived && 'hover:text-amber-400 hover:border-amber-500/40'
            )}
          >
            {isArchived ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Vendor
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                Archive Vendor
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Header Profile Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xl font-mono shrink-0 shadow-inner">
              {vendor.code}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">{vendor.name}</h1>
                <Badge
                  variant={isArchived ? 'secondary' : vendor.status === 'Active' ? 'success' : 'warning'}
                  className="font-mono text-xs"
                >
                  {vendor.status}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs text-purple-300 border-purple-500/30">
                  {vendor.specialization}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs text-emerald-400 border-emerald-500/30">
                  {vendor.security_tier}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono mt-1.5">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-purple-400" />
                  {vendor.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                  Pipe: {vendor.bandwidth_link}
                </span>
                <span>•</span>
                <span className="text-amber-400 font-bold">★ {vendor.rating} / 5.0 Rating</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Tab Strip */}
        <div className="flex items-center gap-1 overflow-x-auto mt-6 pt-4 border-t border-slate-800 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer',
                  isActive
                    ? 'bg-purple-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-slate-400')} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Renderer */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <VendorOverviewTab
            vendor={vendor}
            onNavigateTab={setActiveTab}
            onAddUser={() => setActiveTab('users')}
            onAddProject={() => setActiveTab('projects')}
            onAssignTeam={() => setActiveTab('teams')}
          />
        )}
        {activeTab === 'contacts' && <VendorContactsTab vendor={vendor} />}
        {activeTab === 'users' && <VendorUsersTab vendor={vendor} />}
        {activeTab === 'departments' && <VendorDepartmentsTab vendor={vendor} />}
        {activeTab === 'teams' && <VendorTeamsTab vendor={vendor} />}
        {activeTab === 'projects' && <VendorProjectsTab vendor={vendor} />}
        {activeTab === 'contracts' && <VendorContractsTab vendor={vendor} />}
        {activeTab === 'deliveries' && <VendorDeliveriesTab vendor={vendor} />}
        {activeTab === 'performance' && <VendorPerformanceTab vendor={vendor} />}
        {activeTab === 'activity' && <VendorActivityTab vendor={vendor} />}
      </div>
    </div>
  );
};
