import { EntityHistory } from '@/components/history/EntityHistory';
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
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
  History,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { productionApi } from '@/modules/production/api/productionApi';
import { useClient, useClientMutations } from '@/modules/clients/hooks/useClientsData';
import { ClientContactsTab } from '@/modules/clients/components/client-tabs/ClientContactsTab';
import { ClientContractsTab } from '@/modules/clients/components/client-tabs/ClientContractsTab';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { TabContentTransition } from '@/shared/components/tabs/TabContentTransition';

export const ClientWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<string>('overview');

  const { data: client, isLoading, error } = useClient(id || '');
  const { archiveClient, restoreClient, deleteClient } = useClientMutations();

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'by-client', id],
    queryFn: () => productionApi.getProjects({ client_id: id }),
    enabled: Boolean(id),
  });
  const projects = projectsData?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading client studio workspace...</span>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Client Studio Entity Not Found</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          The requested client studio with ID &quot;{id}&quot; does not exist or has been removed.
        </p>
        <Link to="/clients">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Clients Directory
          </Button>
        </Link>
      </div>
    );
  }

  const isArchived = client.status === 'Archived';
  const isDeleted = client.status === 'Deleted' || Boolean(client.is_deleted);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'projects', label: 'Projects', icon: Film },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'contracts', label: 'Contracts', icon: FileText },
    { id: 'history', label: 'History', icon: History },
  ];
  // Note: Purchase Orders and Reviews deep tabs from the legacy organization
  // module were dropped, not ported: they were mock-data-only surfaces with no
  // backend endpoints. Contacts and Contracts are backed by the flat
  // /api/v1/{client-contacts,client-contracts}/ registries instead.

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white">{client.name}</h1>
                {client.code && (
                  <span className="px-2 py-0.5 rounded bg-indigo-950 font-mono text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                    {client.code}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${
                    isDeleted
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : isArchived
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {client.status || 'Active'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {[client.city, client.country].filter(Boolean).join(', ') || 'Location not set'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/clients">
              <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Directory
              </Button>
            </Link>
            {isArchived ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => restoreClient.mutate(client.id)}
              >
                Restore
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Archive className="w-3.5 h-3.5" />}
                onClick={() => archiveClient.mutate(client.id)}
              >
                Archive
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => deleteClient.mutate(client.id)}
            >
              Trash
            </Button>
          </div>
        </div>
      </div>

      <ScrollableTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <TabContentTransition tabKey={activeTab}>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">Studio Profile</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {client.description || 'No description provided for this client studio.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px]">Code</span>
                  <span className="text-white font-semibold">{client.code || '—'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px]">Status</span>
                  <span className="text-white font-semibold">{client.status || 'Active'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px] flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Website
                  </span>
                  <span className="text-indigo-300 font-semibold break-all">{client.website || '—'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                  <span className="text-slate-500 block text-[10px] flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Primary Email
                  </span>
                  <span className="text-white font-semibold break-all">{client.email || '—'}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-sky-400" />
                Engaged Projects
              </h3>
              <div className="text-3xl font-black text-white font-mono">{projects.length}</div>
              <p className="text-xs text-slate-400">Active production engagements for this client.</p>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-3">
            {projects.length === 0 && (
              <div className="p-10 text-center text-xs font-mono text-slate-500 bg-slate-900/60 rounded-2xl border border-slate-800">
                No projects linked to this client yet.
              </div>
            )}
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="block p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/40 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{project.name}</span>
                  {project.code && (
                    <span className="px-1.5 py-0.2 rounded bg-sky-950 font-mono text-[10px] font-bold text-sky-300 border border-sky-500/30">
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

        {activeTab === 'contacts' && id && <ClientContactsTab clientId={id} />}

        {activeTab === 'contracts' && id && <ClientContractsTab clientId={id} />}

        {activeTab === 'history' && id && <EntityHistory targetType="Client" targetId={id} title="Client history" />}
      </TabContentTransition>
    </div>
  );
};
