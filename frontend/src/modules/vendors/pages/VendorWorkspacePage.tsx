import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Briefcase,
  ArrowLeft,
  Archive,
  RotateCcw,
  Trash2,
  Film,
  MapPin,
  Globe,
  Mail,
  Users,
  FileText,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { productionApi } from '@/modules/production/api/productionApi';
import { useVendor, useVendorMutations } from '@/modules/vendors/hooks/useVendorsData';
import { VendorContactsTab } from '@/modules/vendors/components/vendor-tabs/VendorContactsTab';
import { VendorContractsTab } from '@/modules/vendors/components/vendor-tabs/VendorContractsTab';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { TabContentTransition } from '@/shared/components/tabs/TabContentTransition';

export const VendorWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<string>('overview');

  const { data: vendor, isLoading, error } = useVendor(id || '');
  const { archiveVendor, restoreVendor, deleteVendor } = useVendorMutations();

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'by-vendor', id],
    queryFn: () => productionApi.getProjects({ vendor_id: id }),
    enabled: Boolean(id),
  });
  const projects = projectsData?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading vendor workspace...</span>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <Briefcase className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Vendor Partner Not Found</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          The requested vendor partner with ID &quot;{id}&quot; does not exist or has been removed.
        </p>
        <Link to="/vendors">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Vendors Directory
          </Button>
        </Link>
      </div>
    );
  }

  const isArchived = vendor.status === 'Archived';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Briefcase },
    { id: 'projects', label: 'Projects', icon: Film },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'contracts', label: 'Contracts', icon: FileText },
  ];
  // Note: Purchase Orders and Reviews deep tabs from the legacy organization
  // module were dropped, not ported: they were mock-data-only surfaces with no
  // backend endpoints. Contacts and Contracts are backed by the flat
  // /api/v1/{vendor-contacts,vendor-contracts}/ registries instead.

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white">{vendor.name}</h1>
                {vendor.code && (
                  <span className="px-2 py-0.5 rounded bg-cyan-950 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                    {vendor.code}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${
                    isArchived
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {vendor.status || 'Approved Partner'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {[vendor.city, vendor.country].filter(Boolean).join(', ') || 'Location not set'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/vendors">
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Directory
              </Button>
            </Link>
            {isArchived ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => restoreVendor.mutate(vendor.id)}
              >
                Restore
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Archive className="w-3.5 h-3.5" />}
                onClick={() => archiveVendor.mutate(vendor.id)}
              >
                Archive
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => deleteVendor.mutate(vendor.id)}
            >
              Remove
            </Button>
          </div>
        </div>
      </div>

      <ScrollableTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <TabContentTransition tabKey={activeTab}>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">Partner Profile</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {vendor.description || 'No description provided for this vendor partner.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px]">Code</span>
                  <span className="text-white font-semibold">{vendor.code || '—'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px]">Status</span>
                  <span className="text-white font-semibold">{vendor.status || 'Approved Partner'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px] flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Website
                  </span>
                  <span className="text-indigo-300 font-semibold break-all">{vendor.website || '—'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px] flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Primary Email
                  </span>
                  <span className="text-white font-semibold break-all">{vendor.email || '—'}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                Partner Workload
              </h3>
              <div className="text-3xl font-black text-white font-mono">{projects.length}</div>
              <p className="text-xs text-slate-400">Projects delivered by this partner.</p>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-3">
            {projects.length === 0 && (
              <div className="p-10 text-center text-xs font-mono text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
                No projects linked to this vendor yet.
              </div>
            )}
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="block p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{project.name}</span>
                  {project.code && (
                    <span className="px-1.5 py-0.2 rounded bg-cyan-950 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                      {project.code}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] font-mono ml-auto">
                    {project.status || 'Active'}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}

        {activeTab === 'contacts' && id && <VendorContactsTab vendorId={id} />}

        {activeTab === 'contracts' && id && <VendorContractsTab vendorId={id} />}
      </TabContentTransition>
    </div>
  );
};
