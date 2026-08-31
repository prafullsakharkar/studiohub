import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  ArrowRight,
  ExternalLink,
  Edit,
  Trash2,
  Clock,
  MapPin,
  Globe,
  Cpu,
} from 'lucide-react';
import { useOffices, useOfficeMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';

export const OfficesPage: React.FC = () => {
  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();
  const [search, setSearch] = useState('');

  const { data: offices, isLoading } = useOffices();
  const { deleteOffice } = useOfficeMutations();

  const filteredOffices = (offices || []).filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.city.toLowerCase().includes(search.toLowerCase()) ||
      o.country.toLowerCase().includes(search.toLowerCase()) ||
      o.manager_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenWorkspace = (o: any) => {
    openTab(
      {
        id: o.id,
        title: o.name,
        type: 'office',
        code: o.city.substring(0, 3).toUpperCase(),
      },
      o.name
    );
    navigate(`/offices/${o.id}`);
  };

  const handleDelete = (o: any) => {
    if (window.confirm(`Are you sure you want to remove office facility ${o.name}?`)) {
      deleteOffice.mutate(o.id);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Global Studio Locations & Hubs</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {offices?.length || 0} Facilities
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Physical studio facilities, regional timezones, local render farms, and working shift hours.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/offices/new" className="inline-flex">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Establish Office
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search offices, cities, countries, managers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-full"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredOffices.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No studio locations found</p>
          <p className="text-xs text-slate-500 mt-1">Register a global facility to manage physical seats and timezone shifts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffices.map((office) => (
            <div
              key={office.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      onClick={() => handleOpenWorkspace(office)}
                      className="font-bold text-sm text-white hover:text-indigo-300 cursor-pointer transition-colors"
                    >
                      {office.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-slate-400 font-mono mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{office.city}, {office.country}</span>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                    {office.headcount} artists
                  </Badge>
                </div>

                <div className="space-y-1.5 mt-3 text-xs text-slate-400 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">General Manager:</span>
                    <span className="text-slate-200">{office.manager_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Timezone:</span>
                    <span className="text-emerald-400">{office.timezone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Workstations:</span>
                    <span className="text-white">{office.workstations_count || 120} desks</span>
                  </div>
                </div>

                {/* Compute specs */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{office.working_hours}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-indigo-400">
                    <Cpu className="w-3 h-3" />
                    <span>{office.render_nodes_count || 320} nodes</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleOpenWorkspace(office)}
                  rightIcon={<ExternalLink className="w-3 h-3" />}
                  className="text-[11px]"
                >
                  Workspace
                </Button>

                <div className="flex items-center gap-1">
                  <Link to={`/offices/${office.id}/edit`}>
                    <Button size="xs" variant="ghost" className="p-1.5" title="Edit Office">
                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </Link>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="p-1.5 text-rose-400 hover:bg-rose-950/30"
                    onClick={() => handleDelete(office)}
                    title="Delete Office"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
