import React, { useState, useMemo } from 'react';
import {
  Building2,
  Globe,
  HardDrive,
  Users,
  Film,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  Cpu,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUpDown,
  Archive,
  RotateCcw,
  Trash2,
  Edit,
  LayoutGrid,
  List as ListIcon,
  Filter,
  Check,
  AlertTriangle,
  Star,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrganizations } from '../hooks/useOrganizations';
import { useOrganizationMutations } from '../hooks/useOrganizationMutations';
import { useOrganization } from '@/core/organization/useOrganization';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { cn } from '@/shared/utils/cn';
import { Organization, StudioStatus, OrganizationTier } from '@/types/organization';

export const OrganizationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrganization, switchOrganization, favoriteOrgIds, toggleFavorite } = useOrganization();
  const { data: orgs = [], isLoading, refetch } = useOrganizations();
  const { archiveOrganization, restoreOrganization, deleteOrganization, isArchiving, isRestoring, isDeleting } =
    useOrganizationMutations();

  // Filters & State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('name_asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 6;

  // Modals for actions
  const [deleteModalOrg, setDeleteModalOrg] = useState<Organization | null>(null);
  const [archiveModalOrg, setArchiveModalOrg] = useState<Organization | null>(null);

  // Extract unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    orgs.forEach((o) => {
      const city = o.headquarters.split(',')[0].trim();
      if (city) locs.add(city);
    });
    return Array.from(locs);
  }, [orgs]);

  // Filter and sort logic
  const filteredAndSortedOrgs = useMemo(() => {
    let result = [...orgs];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.code.toLowerCase().includes(q) ||
          o.headquarters.toLowerCase().includes(q) ||
          o.primary_contact_name.toLowerCase().includes(q) ||
          o.tier.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (tierFilter !== 'ALL') {
      result = result.filter((o) => o.tier === tierFilter);
    }

    if (locationFilter !== 'ALL') {
      result = result.filter((o) => o.headquarters.toLowerCase().includes(locationFilter.toLowerCase()));
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'projects_desc':
          return b.active_projects_count - a.active_projects_count;
        case 'crew_desc':
          return b.crew_count - a.crew_count;
        case 'storage_desc':
          return b.storage_used_tb - a.storage_used_tb;
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [orgs, search, statusFilter, tierFilter, locationFilter, sortBy]);

  // Paginated slice
  const totalPages = Math.ceil(filteredAndSortedOrgs.length / pageSize) || 1;
  const paginatedOrgs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedOrgs.slice(start, start + pageSize);
  }, [filteredAndSortedOrgs, page, pageSize]);

  // Global KPIs across all orgs
  const studioMetrics = useMemo(() => {
    const totalCrew = orgs.reduce((acc, o) => acc + (o.crew_count || 0), 0);
    const totalProjects = orgs.reduce((acc, o) => acc + (o.active_projects_count || 0), 0);
    const totalStorage = orgs.reduce((acc, o) => acc + (o.storage_used_tb || 0), 0);
    const totalOffices = orgs.reduce((acc, o) => acc + (o.offices_count || 0), 0);
    return { totalCrew, totalProjects, totalStorage: totalStorage.toFixed(1), totalOffices };
  }, [orgs]);

  const handleConfirmDelete = async () => {
    if (!deleteModalOrg) return;
    await deleteOrganization(deleteModalOrg.id);
    setDeleteModalOrg(null);
  };

  const handleConfirmArchive = async () => {
    if (!archiveModalOrg) return;
    await archiveOrganization(archiveModalOrg.id);
    setArchiveModalOrg(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">Studio Organizations</h1>
                <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
                  {orgs.length} Multi-Tenant Units
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized management for studio tenancies, facility hubs, pipeline defaults, and tenant isolation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Link to="/organizations/new">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              New Studio Organization
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Studio Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Active Studios</span>
            <div className="text-lg font-bold text-white font-mono">{orgs.length}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Total Shows</span>
            <div className="text-lg font-bold text-white font-mono">{studioMetrics.totalProjects}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Global Crew</span>
            <div className="text-lg font-bold text-white font-mono">{studioMetrics.totalCrew}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Storage Used</span>
            <div className="text-lg font-bold text-white font-mono">{studioMetrics.totalStorage} TB</div>
          </div>
        </div>
      </div>

      {/* Search, Filter & Sort Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by studio name, code, contact, HQ location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Onboarding">Onboarding</option>
            <option value="Suspended">Suspended</option>
            <option value="Archived">Archived</option>
          </select>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Tiers</option>
            <option value="Enterprise Vanguard">Enterprise Vanguard</option>
            <option value="Global Multi-Site">Global Multi-Site</option>
            <option value="Studio Pro">Studio Pro</option>
            <option value="Indie">Indie</option>
          </select>

          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Locations</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500 font-mono"
          >
            <option value="name_asc">Sort: Name (A-Z)</option>
            <option value="name_desc">Sort: Name (Z-A)</option>
            <option value="projects_desc">Sort: Projects Count</option>
            <option value="crew_desc">Sort: Crew Size</option>
            <option value="storage_desc">Sort: Storage Used</option>
            <option value="created_desc">Sort: Newest</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/80 p-0.5 ml-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors',
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-1.5 rounded-md text-xs transition-colors',
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
              title="Dense Table View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or Table Display */}
      {filteredAndSortedOrgs.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/60 border border-slate-800">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Studio Organizations Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            No studio tenancy matches your search and filter criteria. Adjust the parameters or register a new studio.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearch('');
              setStatusFilter('ALL');
              setTierFilter('ALL');
              setLocationFilter('ALL');
            }}
          >
            Clear All Filters
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedOrgs.map((org) => {
            const isCurrent = org.id === currentOrganization.id;
            const isFavorite = favoriteOrgIds.includes(org.id);
            const storagePercentage = Math.min(100, Math.round((org.storage_used_tb / org.storage_quota_tb) * 100));

            return (
              <div
                key={org.id}
                className={cn(
                  'rounded-xl border transition-all relative overflow-hidden bg-slate-900/90 flex flex-col justify-between group shadow-sm',
                  isCurrent
                    ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-950/40'
                    : 'border-slate-800 hover:border-slate-700'
                )}
              >
                {/* Banner backdrop if present */}
                {org.banner_url && (
                  <div className="h-16 w-full relative overflow-hidden border-b border-slate-800/80 bg-slate-950">
                    <img src={org.banner_url} alt="" className="w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                  </div>
                )}

                {/* Card Main Body */}
                <div className="p-4 space-y-3.5 flex-1">
                  {/* Top info row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={org.logo_url}
                        alt={org.name}
                        className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-700 shadow-md shrink-0 bg-slate-950"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="font-bold text-sm text-white truncate group-hover:text-indigo-300 transition-colors">
                            {org.name}
                          </h2>
                          <button
                            onClick={() => toggleFavorite(org.id)}
                            className="text-slate-500 hover:text-amber-400 p-0.5"
                            title={isFavorite ? 'Starred' : 'Add to Starred'}
                          >
                            <Star
                              className={cn('w-3.5 h-3.5', isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-600')}
                            />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                            {org.code}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate">{org.tier}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          org.status === 'Active'
                            ? 'success'
                            : org.status === 'Onboarding'
                            ? 'info'
                            : org.status === 'Suspended'
                            ? 'warning'
                            : 'neutral'
                        }
                        className="text-[10px] uppercase font-mono font-semibold"
                      >
                        {org.status}
                      </Badge>
                      {isCurrent && (
                        <span className="text-[10px] font-mono font-bold text-indigo-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Active Tenant
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location & Contact */}
                  <div className="text-xs text-slate-400 space-y-1 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{org.headquarters}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">
                        Contact: <strong className="text-slate-300">{org.primary_contact_name}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Projects</div>
                      <div className="text-xs font-bold text-white">{org.active_projects_count}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Crew Size</div>
                      <div className="text-xs font-bold text-white">{org.crew_count}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Offices</div>
                      <div className="text-xs font-bold text-white">{org.offices_count}</div>
                    </div>
                  </div>

                  {/* Storage Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-slate-500" />
                        Storage Quota
                      </span>
                      <span className="font-mono text-slate-300 text-[10px]">
                        {org.storage_used_tb} / {org.storage_quota_tb} TB ({storagePercentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          storagePercentage > 90 ? 'bg-rose-500' : storagePercentage > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                        )}
                        style={{ width: `${storagePercentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {!isCurrent ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => switchOrganization(org.id)}
                        className="text-[11px] font-medium"
                      >
                        Switch Tenant
                      </Button>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Link to={`/organizations/${org.id}/edit`}>
                      <button
                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Edit Organization Profile"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </Link>

                    {org.status !== 'Archived' ? (
                      <button
                        onClick={() => setArchiveModalOrg(org)}
                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                        title="Archive Studio"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => restoreOrganization(org.id)}
                        className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Restore Studio"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteModalOrg(org)}
                      className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete Studio (Admin)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <Link to={`/organizations/${org.id}`}>
                      <Button
                        size="xs"
                        variant="primary"
                        rightIcon={<ExternalLink className="w-3 h-3" />}
                        className="text-[11px]"
                      >
                        Workspace
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/90 shadow-sm">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Studio Entity</th>
                <th className="py-3 px-4">Status & Tier</th>
                <th className="py-3 px-4">Headquarters</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-center">Shows</th>
                <th className="py-3 px-4 text-center">Crew</th>
                <th className="py-3 px-4">Storage (TB)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginatedOrgs.map((org) => {
                const isCurrent = org.id === currentOrganization.id;
                return (
                  <tr
                    key={org.id}
                    className={cn(
                      'hover:bg-slate-800/40 transition-colors',
                      isCurrent ? 'bg-indigo-950/15' : ''
                    )}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={org.logo_url}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{org.name}</span>
                            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-1 rounded border border-indigo-500/30">
                              {org.code}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">{org.slug}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <Badge
                          variant={org.status === 'Active' ? 'success' : 'neutral'}
                          className="text-[9px] uppercase font-mono"
                        >
                          {org.status}
                        </Badge>
                        <div className="text-[10px] text-slate-400">{org.tier}</div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-slate-300">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span>{org.headquarters}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div>
                        <div className="text-white font-medium">{org.primary_contact_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{org.primary_contact_email}</div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-white">
                      {org.active_projects_count}
                    </td>

                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      {org.crew_count}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-[11px] font-mono text-slate-300">
                        {org.storage_used_tb} / {org.storage_quota_tb} TB
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isCurrent ? (
                          <Button size="xs" variant="outline" onClick={() => switchOrganization(org.id)}>
                            Switch
                          </Button>
                        ) : (
                          <span className="text-[10px] font-mono font-bold text-indigo-400 px-2 py-1">Active</span>
                        )}
                        <Link to={`/organizations/${org.id}`}>
                          <Button size="xs" variant="primary">
                            Open
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400 font-mono">
          <div>
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, filteredAndSortedOrgs.length)} of {filteredAndSortedOrgs.length} studios
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs">
              {page} / {totalPages}
            </span>
            <Button
              size="xs"
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteModalOrg)}
        onClose={() => setDeleteModalOrg(null)}
        title="Delete Studio Tenancy"
        subtitle={`Are you sure you want to permanently delete ${deleteModalOrg?.name}?`}
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Destructive Operation:</strong>
              This will remove the organization isolation boundary. Make sure all production data and shows have been
              re-routed or backed up.
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOrg(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        isOpen={Boolean(archiveModalOrg)}
        onClose={() => setArchiveModalOrg(null)}
        title="Archive Studio Organization"
        subtitle={`Suspend operations and place ${archiveModalOrg?.name} into read-only mode.`}
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p>
            Archiving places all projects, shot pipelines, and render allocations into read-only mode. You can restore
            the studio at any time.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setArchiveModalOrg(null)}>
              Cancel
            </Button>
            <Button
              variant="warning"
              size="sm"
              isLoading={isArchiving}
              onClick={handleConfirmArchive}
            >
              Archive Studio
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
