import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building,
  User,
  Film,
  FileText,
  Briefcase,
  CheckCircle2,
  Eye,
  DollarSign,
  Activity,
  ArrowLeft,
  Edit,
  Archive,
  RotateCcw,
  Trash2,
  Download,
  Plus,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { useClient, useClientMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

// Import Tab Components
import { ClientOverviewTab } from '../components/client-tabs/ClientOverviewTab';
import { ClientContactsTab } from '../components/client-tabs/ClientContactsTab';
import { ClientProjectsTab } from '../components/client-tabs/ClientProjectsTab';
import { ClientContractsTab } from '../components/client-tabs/ClientContractsTab';
import { ClientPurchaseOrdersTab } from '../components/client-tabs/ClientPurchaseOrdersTab';
import { ClientDeliverablesTab } from '../components/client-tabs/ClientDeliverablesTab';
import { ClientReviewsTab } from '../components/client-tabs/ClientReviewsTab';
import { ClientBillingTab } from '../components/client-tabs/ClientBillingTab';
import { ClientActivityTab } from '../components/client-tabs/ClientActivityTab';

export const ClientWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');

  const { data: client, isLoading, error } = useClient(id || '');
  const { archiveClient, restoreClient, deleteClient } = useClientMutations();

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
          <Building className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Client Studio Entity Not Found</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          The requested client organization entity with ID "{id}" does not exist or has been removed.
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

  const handleArchiveToggle = () => {
    if (isArchived) {
      if (confirm(`Restore client "${client.name}" to Active status?`)) {
        restoreClient.mutate(client.id);
      }
    } else {
      if (confirm(`Archive client "${client.name}"? Active project references will be preserved.`)) {
        archiveClient.mutate(client.id);
      }
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to permanently delete "${client.name}"? This action cannot be undone.`)) {
      deleteClient.mutate(client.id, {
        onSuccess: () => navigate('/clients'),
      });
    }
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(client, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `client_${client.code.toLowerCase()}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'contacts', label: 'Contacts', icon: User },
    { id: 'projects', label: 'Projects', icon: Film },
    { id: 'contracts', label: 'Contracts', icon: FileText },
    { id: 'purchase_orders', label: 'Purchase Orders', icon: Briefcase },
    { id: 'deliverables', label: 'Deliverables', icon: CheckCircle2 },
    { id: 'reviews', label: 'Reviews', icon: Eye },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Context Top Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Entity Identity & Badges */}
          <div className="flex items-start sm:items-center gap-4">
            <Link
              to="/clients"
              className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
              title="Return to Clients Directory"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xl font-mono shrink-0 shadow-inner">
              {client.code}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">{client.name}</h1>
                <Badge variant="outline" className="font-mono text-xs text-indigo-300 bg-indigo-950/40 border-indigo-500/30">
                  {client.code}
                </Badge>
                <Badge
                  variant={isArchived ? 'secondary' : client.status === 'Active' ? 'success' : 'warning'}
                  className="text-xs font-medium"
                >
                  {client.status}
                </Badge>
                {client.contract_tier && (
                  <Badge variant="secondary" className="text-xs text-slate-300">
                    Tier: {client.contract_tier}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-slate-400 font-mono">
                <span>Studio: <strong className="text-slate-200">{client.studio_type}</strong></span>
                <span>•</span>
                <span>HQ: <strong className="text-slate-200">{client.headquarters}</strong></span>
                <span>•</span>
                <span>Billed: <strong className="text-emerald-400">${(client.total_billed_usd / 1000000).toFixed(2)}M</strong></span>
                <span>•</span>
                <span>Active Shows: <strong className="text-indigo-300">{client.active_projects.length}</strong></span>
              </div>
            </div>
          </div>

          {/* Context Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/clients/${client.id}/edit`}>
              <Button size="sm" variant="outline" className="text-xs flex items-center gap-1.5">
                <Edit className="w-3.5 h-3.5" />
                Edit Studio
              </Button>
            </Link>

            <Button
              size="sm"
              variant="outline"
              onClick={handleArchiveToggle}
              className={`text-xs flex items-center gap-1.5 ${
                isArchived ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              {isArchived ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore Client
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              className="text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border-rose-900/40 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content Area */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && (
          <ClientOverviewTab
            client={client}
            onNavigateTab={setActiveTab}
            onAddContact={() => setActiveTab('contacts')}
            onAddProject={() => setActiveTab('projects')}
          />
        )}
        {activeTab === 'contacts' && <ClientContactsTab client={client} />}
        {activeTab === 'projects' && <ClientProjectsTab client={client} />}
        {activeTab === 'contracts' && <ClientContractsTab client={client} />}
        {activeTab === 'purchase_orders' && <ClientPurchaseOrdersTab client={client} />}
        {activeTab === 'deliverables' && <ClientDeliverablesTab client={client} />}
        {activeTab === 'reviews' && <ClientReviewsTab client={client} />}
        {activeTab === 'billing' && <ClientBillingTab client={client} />}
        {activeTab === 'activity' && <ClientActivityTab client={client} />}
      </div>
    </div>
  );
};
