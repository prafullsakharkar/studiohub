import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Search,
  Plus,
  Users,
  Cpu,
  ArrowRight,
  ExternalLink,
  Edit,
  Trash2,
  Clock,
  BarChart3,
} from 'lucide-react';
import { useDepartments, useDepartmentMutations } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';

export const DepartmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();
  const [search, setSearch] = useState('');

  const { data: departments, isLoading } = useDepartments();
  const { deleteDepartment } = useDepartmentMutations();

  const depts = (departments || []).filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      (d.software_stack || []).some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenWorkspace = (d: any) => {
    openTab(
      {
        id: d.id,
        title: d.name,
        type: 'department',
        code: d.code,
      },
      d.name
    );
    navigate(`/departments/${d.id}`);
  };

  const handleDelete = (d: any) => {
    if (window.confirm(`Are you sure you want to delete department ${d.name}?`)) {
      deleteDepartment.mutate(d.id);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Production Departments & Crafts</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {departments?.length || 0} Craft Divisions
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Core studio craft disciplines, supervisor assignments, toolchains, and capacity quotas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/departments/new" className="inline-flex">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Create Department
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search departments, codes, DCC tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-full"
          />
        </div>
      </div>

      {/* Department Cards Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : depts.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No departments found</p>
          <p className="text-xs text-slate-500 mt-1">Initialize a new craft division to organize studio workflows.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {depts.map((dept) => (
            <div
              key={dept.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-white text-sm shrink-0 shadow-sm"
                      style={{ backgroundColor: dept.color || '#6366f1' }}
                    >
                      {dept.code}
                    </div>
                    <div>
                      <h3
                        onClick={() => handleOpenWorkspace(dept)}
                        className="font-bold text-sm text-white hover:text-indigo-300 cursor-pointer transition-colors"
                      >
                        {dept.name}
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">Head: {dept.head_name}</span>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                    {dept.member_count} artists
                  </Badge>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-2">{dept.description}</p>

                {/* Software Stack */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {(dept.software_stack || []).map((sw) => (
                    <span
                      key={sw}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300"
                    >
                      {sw}
                    </span>
                  ))}
                </div>

                {/* Capacity metric */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{dept.capacity_hours_weekly || 160}h/wk</span>
                  </div>
                  <div className="flex items-center justify-end gap-1 text-emerald-400">
                    <BarChart3 className="w-3 h-3" />
                    <span>{dept.utilization_percentage || 80}% util</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleOpenWorkspace(dept)}
                  rightIcon={<ExternalLink className="w-3 h-3" />}
                  className="text-[11px]"
                >
                  Workspace
                </Button>

                <div className="flex items-center gap-1">
                  <Link to={`/departments/${dept.id}/edit`}>
                    <Button size="xs" variant="ghost" className="p-1.5" title="Edit Department">
                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </Link>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="p-1.5 text-rose-400 hover:bg-rose-950/30"
                    onClick={() => handleDelete(dept)}
                    title="Delete Department"
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
