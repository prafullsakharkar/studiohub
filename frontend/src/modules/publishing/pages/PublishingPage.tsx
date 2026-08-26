import React, { useState, useMemo } from 'react';
import { usePublishing } from '../hooks/usePublishing';
import { PublishItem } from '@/types/publishing';
import { PublishCard } from '../components/PublishCard';
import { PublishDetailsModal } from '../components/PublishDetailsModal';
import { CreatePublishModal } from '../components/CreatePublishModal';
import { RepublishModal } from '../components/RepublishModal';
import { UnpublishModal } from '../components/UnpublishModal';
import { PublishHistoryModal } from '../components/PublishHistoryModal';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  UploadCloud,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  Plus,
  Layers,
  Terminal,
  Grid,
  List,
} from 'lucide-react';

export const PublishingPage: React.FC = () => {
  const {
    publishes,
    destinations,
    loading,
    publish,
    republish,
    unpublish,
    validate,
    retry,
    refresh,
  } = usePublishing();

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedDcc, setSelectedDcc] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal States
  const [inspectItem, setInspectItem] = useState<PublishItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [republishItem, setRepublishItem] = useState<PublishItem | null>(null);
  const [unpublishItem, setUnpublishItem] = useState<PublishItem | null>(null);
  const [historyItem, setHistoryItem] = useState<PublishItem | null>(null);

  // Filtered Publishes
  const filteredPublishes = useMemo(() => {
    return publishes.filter((item) => {
      const matchesSearch =
        item.publish_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.entity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.entity_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.artist_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesProject = selectedProject === 'ALL' || item.project_code === selectedProject;
      const matchesDept = selectedDept === 'ALL' || item.department === selectedDept;
      const matchesDcc = selectedDcc === 'ALL' || item.dcc_software === selectedDcc;
      const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

      return matchesSearch && matchesProject && matchesDept && matchesDcc && matchesStatus;
    });
  }, [publishes, searchQuery, selectedProject, selectedDept, selectedDcc, selectedStatus]);

  // Key Metrics
  const metrics = useMemo(() => {
    const total = publishes.length;
    const publishedCount = publishes.filter((p) => p.status === 'Published' || p.status === 'Republished').length;
    const failedCount = publishes.filter((p) => p.status === 'Failed').length;
    const validatingCount = publishes.filter((p) => p.status === 'Validating').length;
    const totalSizeGB = (
      publishes.reduce((acc, p) => acc + (p.total_size_bytes || 0), 0) /
      (1024 * 1024 * 1024)
    ).toFixed(1);
    const passRate = total > 0 ? Math.round((publishedCount / total) * 100) : 100;

    return { total, publishedCount, failedCount, validatingCount, totalSizeGB, passRate };
  }, [publishes]);

  return (
    <div id="publishing-hub-page" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Production Publishing Hub</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Pyblish & USD Ingest
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated pre-flight QC, version indexing, and centralized asset/shot publish management across DCCs.
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
            id="btn-create-publish"
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            Publish New Version
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Total Published Entities</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-white font-mono">{metrics.total}</span>
            <span className="text-xs text-emerald-400 font-semibold">{metrics.publishedCount} Live</span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Pre-Flight QC Pass Rate</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-400 font-mono">{metrics.passRate}%</span>
            <span className="text-xs text-slate-400 font-mono">Pyblish Engine</span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Validation Failures / Gaps</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-2xl font-bold font-mono ${metrics.failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {metrics.failedCount}
            </span>
            <span className="text-xs text-slate-400">Needs Retry</span>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 block">Total Managed Payload</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-indigo-400 font-mono">{metrics.totalSizeGB} GB</span>
            <span className="text-xs text-slate-400 font-mono">NFS / S3 / USD</span>
          </div>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <Card className="p-4 bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by publish code, shot name, asset code, or artist..."
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

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full md:w-40 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            <option value="Compositing">Compositing</option>
            <option value="Lighting">Lighting & LookDev</option>
            <option value="FX & Simulation">FX & Simulation</option>
            <option value="3D Modeling & Assets">3D Modeling</option>
          </select>

          {/* DCC Filter */}
          <select
            value={selectedDcc}
            onChange={(e) => setSelectedDcc(e.target.value)}
            className="w-full md:w-36 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="ALL">All DCCs</option>
            <option value="Nuke">Nuke</option>
            <option value="Maya">Maya</option>
            <option value="Houdini">Houdini</option>
            <option value="Blender">Blender</option>
            <option value="Unreal">Unreal</option>
            <option value="USD">OpenUSD</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-36 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Published">Published</option>
            <option value="Validating">Validating</option>
            <option value="Failed">QC Failed</option>
            <option value="Unpublished">Unpublished</option>
          </select>

          {/* View Mode Toggle */}
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

      {/* Main Grid / Table Content */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Loading publish registry & QC indices...</span>
        </div>
      ) : filteredPublishes.length === 0 ? (
        <EmptyState
          icon={<UploadCloud className="w-8 h-8 text-indigo-400" />}
          title="No Published Entities Found"
          description="No published shot cuts or asset versions match your filter criteria."
          actionLabel="Publish First Entity"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPublishes.map((item) => (
            <PublishCard
              key={item.id}
              item={item}
              onInspect={(p) => setInspectItem(p)}
              onRepublish={(p) => setRepublishItem(p)}
              onValidate={(id) => validate(id)}
              onRetry={(id) => retry(id)}
              onUnpublish={(p) => setUnpublishItem(p)}
              onViewHistory={(p) => setHistoryItem(p)}
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
                  <th className="px-4 py-3">Publish Code</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Dept / DCC</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Size / Frames</th>
                  <th className="px-4 py-3">Artist</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredPublishes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white truncate max-w-xs">{item.publish_code}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {item.entity_type}: {item.entity_code}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {item.department} ({item.dcc_software})
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{item.version_number}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          item.status === 'Published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'Failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {item.total_size_formatted} ({item.total_frames || item.file_count || 1}f)
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-sans">{item.artist_name}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setInspectItem(item)} className="text-[11px] py-1">
                          Inspect
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRepublishItem(item)}
                          className="text-[11px] py-1 text-indigo-300"
                        >
                          Republish
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <PublishDetailsModal
        isOpen={!!inspectItem}
        onClose={() => setInspectItem(null)}
        item={inspectItem}
        onValidate={(id) => validate(id)}
        onRetry={(id) => retry(id)}
        onRepublish={(p) => {
          setInspectItem(null);
          setRepublishItem(p);
        }}
        onUnpublish={(p) => {
          setInspectItem(null);
          setUnpublishItem(p);
        }}
      />

      <CreatePublishModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        destinations={destinations}
        onPublish={publish}
      />

      <RepublishModal
        isOpen={!!republishItem}
        onClose={() => setRepublishItem(null)}
        item={republishItem}
        onConfirm={republish}
      />

      <UnpublishModal
        isOpen={!!unpublishItem}
        onClose={() => setUnpublishItem(null)}
        item={unpublishItem}
        onConfirm={unpublish}
      />

      <PublishHistoryModal
        isOpen={!!historyItem}
        onClose={() => setHistoryItem(null)}
        item={historyItem}
      />
    </div>
  );
};
