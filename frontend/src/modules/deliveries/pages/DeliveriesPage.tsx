import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeliveries } from '../hooks/useDeliveries';
import { DeliveryPackage } from '@/types/deliveries';
import { DeliveryCard } from '../components/DeliveryCard';
import { CreateDeliveryModal } from '../components/CreateDeliveryModal';
import { DeliveryApprovalModal } from '../components/DeliveryApprovalModal';
import { DeliveryRejectModal } from '../components/DeliveryRejectModal';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  Send,
  Plus,
  Search,
  RefreshCw,
  Building,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Calendar,
  Grid,
  List,
  Filter,
} from 'lucide-react';

export const DeliveriesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    deliveries,
    destinations,
    loading,
    refresh,
    createDelivery,
    prepareDelivery,
    submitDelivery,
    approveDelivery,
    rejectDelivery,
    retryDelivery,
  } = useDeliveries();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedClient, setSelectedClient] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [approvalDeliveryId, setApprovalDeliveryId] = useState<string | null>(null);
  const [rejectDeliveryId, setRejectDeliveryId] = useState<string | null>(null);

  // Filtered Deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((item) => {
      const matchesSearch =
        item.package_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.milestone_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
      const matchesProject = selectedProject === 'ALL' || item.project_code === selectedProject;
      const matchesClient =
        selectedClient === 'ALL' || item.client.name.toLowerCase().includes(selectedClient.toLowerCase());

      return matchesSearch && matchesStatus && matchesProject && matchesClient;
    });
  }, [deliveries, searchQuery, selectedStatus, selectedProject, selectedClient]);

  // Metrics
  const metrics = useMemo(() => {
    const total = deliveries.length;
    const submittedCount = deliveries.filter((d) => d.status === 'Submitted').length;
    const approvedCount = deliveries.filter((d) => d.status === 'Approved' || d.status === 'Completed').length;
    const rejectedCount = deliveries.filter((d) => d.status === 'Rejected').length;
    const totalGB = (
      deliveries.reduce((acc, d) => acc + (d.total_size_bytes || 0), 0) /
      (1024 * 1024 * 1024)
    ).toFixed(1);

    return { total, submittedCount, approvedCount, rejectedCount, totalGB };
  }, [deliveries]);

  return (
    <div id="deliveries-page-root" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Studio Deliveries & Turnovers</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Aspera & Signiant Ingest
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Official client turnover packages, automated pre-flight QC inspection, Aspera/Signiant transfers, and sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            className="text-xs text-slate-300"
          >
            Refresh
          </Button>

          <Button
            id="btn-create-delivery"
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            New Delivery Package
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Total Turnover Packages</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-white font-mono">{metrics.total}</span>
            <span className="text-xs text-slate-400">All Turnovers</span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Awaiting Client Review</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-indigo-400 font-mono">{metrics.submittedCount}</span>
            <span className="text-xs text-indigo-300">Submitted</span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Client Approved Turnovers</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-400 font-mono">{metrics.approvedCount}</span>
            <span className="text-xs text-emerald-400">Locked</span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Managed Delivery Payload</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-cyan-400 font-mono">{metrics.totalGB} GB</span>
            <span className="text-xs text-slate-400">Aspera / S3</span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by package code, client name, title, or milestone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Project Filter */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full md:w-36 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Projects</option>
            <option value="NK99">Neo Kyoto 2099</option>
            <option value="ATH">Aetheria S2</option>
            <option value="CBR">CyberRunner</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-40 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Preparing">Preparing</option>
            <option value="Ready">Ready</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Completed">Completed</option>
          </select>

          {/* View Mode */}
          <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Loading delivery manifests and transfer queues...</span>
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <EmptyState
          icon={<Send className="w-8 h-8 text-indigo-400" />}
          title="No Delivery Packages Found"
          description="No turnover packages match your search or filter criteria."
          actionLabel="Create Turnover Package"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDeliveries.map((delivery) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              onOpenWorkspace={(id) => navigate(`/deliveries/${id}`)}
              onSubmit={(id) => submitDelivery(id)}
              onApprove={(id) => setApprovalDeliveryId(id)}
              onReject={(id) => setRejectDeliveryId(id)}
              onRetry={(id) => retryDelivery(id)}
              onPrepare={(id) => prepareDelivery(id)}
            />
          ))}
        </div>
      ) : (
        /* Table View */
        <Card className="bg-slate-900/90 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Package Code</th>
                  <th className="px-4 py-3">Title & Milestone</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Size / Shots</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white truncate max-w-xs">{delivery.package_code}</td>
                    <td className="px-4 py-3 font-sans text-slate-300 truncate max-w-xs">{delivery.title}</td>
                    <td className="px-4 py-3 font-sans text-slate-300">{delivery.client.name}</td>
                    <td className="px-4 py-3 text-slate-400">{delivery.destination.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          delivery.status === 'Approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : delivery.status === 'Rejected'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : delivery.status === 'Submitted'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {delivery.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {delivery.total_size_formatted} ({delivery.total_shots_count || 1} shots)
                    </td>
                    <td className="px-4 py-3 text-slate-400">{new Date(delivery.due_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => navigate(`/deliveries/${delivery.id}`)}
                        className="text-[11px] py-1 bg-indigo-600 hover:bg-indigo-500"
                      >
                        Workspace
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <CreateDeliveryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        destinations={destinations}
        onCreate={createDelivery}
      />

      <DeliveryApprovalModal
        isOpen={!!approvalDeliveryId}
        onClose={() => setApprovalDeliveryId(null)}
        deliveryId={approvalDeliveryId || ''}
        onApprove={approveDelivery}
      />

      <DeliveryRejectModal
        isOpen={!!rejectDeliveryId}
        onClose={() => setRejectDeliveryId(null)}
        deliveryId={rejectDeliveryId || ''}
        onReject={rejectDelivery}
      />
    </div>
  );
};
