import React, { useState } from 'react';
import {
  Layers,
  Search,
  Plus,
  Shield,
  Star,
  Award,
  Globe,
  Film,
  HardDrive,
  Download,
  Edit,
  Archive,
  RotateCcw,
  Eye,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useVendors, useVendorMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';
import { Link, useNavigate } from 'react-router-dom';

export const VendorsPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Under Review' | 'Archived'>('ALL');

  const { data: vendorsData, isLoading } = useVendors({ search });
  const { archiveVendor, restoreVendor } = useVendorMutations();

  const vendors = vendorsData?.results || [];
  const filtered = vendors.filter((v) => {
    const matchSpec = specializationFilter === 'ALL' || v.specialization === specializationFilter;
    const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchSpec && matchStatus;
  });

  const totalTasks = vendors.reduce((acc, v) => acc + (v.active_tasks_count || 0), 0);

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(vendors, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vendors_directory_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Outsourcing & Vendor Partners</h1>
            <Badge variant="outline" className="font-mono text-xs text-purple-300 border-purple-500/30">
              {vendors.length} Partners
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organization-level partner facilities, rotoscope/prep capacities, security accreditations, and SLA performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Directory
          </Button>

          <Link to="/vendors/new">
            <Button
              size="sm"
              variant="primary"
              className="text-xs flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Vendor
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Total Vendor Partners</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{vendors.length}</div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Active Outsourced Tasks</div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-1">{totalTasks} Tasks</div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Active Contracted Shows</div>
          <div className="text-2xl font-bold font-mono text-indigo-300 mt-1">
            {new Set(vendors.flatMap((v) => v.active_projects)).size} Shows
          </div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-mono text-slate-400">Air-Gapped Tier 4 Facilities</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {vendors.filter((v) => v.security_tier.includes('Tier 4')).length} Certified
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'Roto / Prep', 'Creature FX', 'Matchmove', 'Environments', 'Full VFX'].map((spec) => (
            <button
              key={spec}
              onClick={() => setSpecializationFilter(spec)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                specializationFilter === spec
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              )}
            >
              {spec === 'ALL' ? 'All Disciplines' : spec}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-hidden font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Review">Under Review</option>
            <option value="Archived">Archived</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor name, code, pipe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500 w-56 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Vendors Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            No vendor partners match your current filter criteria.
          </div>
        ) : (
          filtered.map((vendor) => {
            const isArchived = vendor.status === 'Archived';
            return (
              <div
                key={vendor.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-base font-mono shrink-0 shadow-inner">
                        {vendor.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/vendors/${vendor.id}`}
                            className="font-bold text-sm text-white hover:text-purple-400 transition-colors"
                          >
                            {vendor.name}
                          </Link>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {vendor.specialization} • {vendor.location}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <Badge
                        variant={isArchived ? 'secondary' : vendor.status === 'Active' ? 'success' : 'warning'}
                        className="text-[10px]"
                      >
                        {vendor.status}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/30">
                        {vendor.security_tier}
                      </Badge>
                    </div>
                  </div>

                  {/* Operational Details */}
                  <div className="mt-4 space-y-3">
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 text-[11px] font-mono">Dedicated Pipe Bandwidth:</span>
                        <span className="font-semibold text-cyan-300 font-mono">{vendor.bandwidth_link}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] pt-1 border-t border-slate-900">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-purple-400" />
                          Capacity: <strong className="text-white">{vendor.active_tasks_count} Tasks</strong>
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {vendor.rating} / 5.0
                        </span>
                      </div>
                    </div>

                    {/* Active Shows */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400 text-[11px] flex items-center gap-1.5 font-mono">
                        <Film className="w-3.5 h-3.5 text-purple-400" />
                        Contracted Shows ({vendor.active_projects.length}):
                      </span>
                      <div className="flex flex-wrap items-center gap-1 justify-end">
                        {vendor.active_projects.map((proj) => (
                          <span
                            key={proj}
                            className="px-2 py-0.5 rounded bg-slate-950 text-purple-300 text-[10px] font-mono border border-slate-800"
                          >
                            {proj}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="text-[11px] font-mono text-slate-400">
                    Location: <span className="text-slate-200">{vendor.location}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link to={`/vendors/${vendor.id}/edit`}>
                      <Button size="sm" variant="ghost" className="text-xs text-slate-400 hover:text-white p-1.5">
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (isArchived) restoreVendor.mutate(vendor.id);
                        else archiveVendor.mutate(vendor.id);
                      }}
                      className="text-xs text-slate-400 hover:text-amber-400 p-1.5"
                      title={isArchived ? 'Restore' : 'Archive'}
                    >
                      {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </Button>

                    <Link to={`/vendors/${vendor.id}`}>
                      <Button size="sm" variant="outline" className="text-xs flex items-center gap-1">
                        Workspace <Eye className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
