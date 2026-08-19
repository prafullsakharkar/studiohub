import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  ExternalLink,
  MoreVertical,
  Edit,
  Trash2,
  ShieldAlert,
  UserCheck,
  UserX,
  Filter,
} from 'lucide-react';
import { usePeople, usePersonMutations, useDepartments, useOffices, useTeams } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Modal } from '@/shared/components/Modal';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';

export const PeoplePage: React.FC = () => {
  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [officeFilter, setOfficeFilter] = useState('ALL');
  const [seniorityFilter, setSeniorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Quick Action Modal states
  const [activePerson, setActivePerson] = useState<any>(null);
  const [actionType, setActionType] = useState<'assign_dept' | 'assign_team' | 'assign_project' | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState('');

  const { data: peopleData, isLoading } = usePeople({ search });
  const { data: departments } = useDepartments();
  const { data: offices } = useOffices();
  const { data: teams } = useTeams();
  const { updatePerson, deletePerson } = usePersonMutations();

  const people = peopleData?.results || [];
  const filtered = people.filter((p) => {
    if (deptFilter !== 'ALL' && p.department_id !== deptFilter && p.department_name !== deptFilter) return false;
    if (officeFilter !== 'ALL' && p.office_id !== officeFilter && p.office_name !== officeFilter) return false;
    if (seniorityFilter !== 'ALL' && p.seniority !== seniorityFilter) return false;
    if (statusFilter !== 'ALL' && (p.status || 'Active') !== statusFilter) return false;
    return true;
  });

  const handleOpenWorkspace = (p: any) => {
    openTab(
      {
        id: p.id,
        title: p.full_name,
        type: 'person',
        code: p.role,
      },
      p.full_name
    );
    navigate(`/people/${p.id}`);
  };

  const handleStatusChange = (p: any, newStatus: 'Active' | 'Inactive' | 'Suspended') => {
    updatePerson.mutate({
      id: p.id,
      data: { status: newStatus },
    });
  };

  const handleDelete = (p: any) => {
    if (window.confirm(`Are you sure you want to remove ${p.full_name} from studio roster?`)) {
      deletePerson.mutate(p.id);
    }
  };

  const handleAssignmentSubmit = () => {
    if (!activePerson || !selectedAssignment) return;
    if (actionType === 'assign_dept') {
      const dept = departments?.find((d) => d.id === selectedAssignment);
      updatePerson.mutate({
        id: activePerson.id,
        data: { department_id: selectedAssignment, department_name: dept?.name || '' },
      });
    } else if (actionType === 'assign_team') {
      const team = teams?.find((t) => t.id === selectedAssignment);
      updatePerson.mutate({
        id: activePerson.id,
        data: { team_id: selectedAssignment, team_name: team?.name || '' },
      });
    } else if (actionType === 'assign_project') {
      const current = activePerson.assigned_projects || ['NK99'];
      if (!current.includes(selectedAssignment)) {
        updatePerson.mutate({
          id: activePerson.id,
          data: { assigned_projects: [...current, selectedAssignment] },
        });
      }
    }
    setActionType(null);
    setActivePerson(null);
    setSelectedAssignment('');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Studio People & Talent Roster</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {filtered.length} of {people.length} Crew Members
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Supervisors, leads, technical directors, and artists across global facilities and timezones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/people/new">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Invite & Provision Artist
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search artists, skills, roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-56"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {(departments || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Facilities</option>
            {(offices || []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <select
            value={seniorityFilter}
            onChange={(e) => setSeniorityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Seniorities</option>
            <option value="Junior">Junior</option>
            <option value="Mid">Mid</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
            <option value="Supervisor">Supervisor</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Main Roster Body */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No crew members found matching filter</p>
          <p className="text-xs text-slate-500 mt-1">Adjust search terms or clear filters to view artist records.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((person) => (
            <div
              key={person.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={person.avatar_url}
                      alt={person.full_name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0"
                    />
                    <div>
                      <h3
                        onClick={() => handleOpenWorkspace(person)}
                        className="font-bold text-sm text-white hover:text-indigo-300 cursor-pointer transition-colors"
                      >
                        {person.full_name}
                      </h3>
                      <p className="text-xs text-slate-400">{person.role}</p>
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded inline-block mt-1">
                        {person.department_name}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={person.status === 'Active' || !person.status ? 'success' : person.status === 'Suspended' ? 'danger' : 'warning'}
                    className="text-[9px] font-mono shrink-0"
                  >
                    {person.status || 'Active'}
                  </Badge>
                </div>

                {/* Details */}
                <div className="mt-3.5 space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{person.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{person.office_name}</span>
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {person.skills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300"
                    >
                      {skill}
                    </span>
                  ))}
                  {person.skills.length > 3 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-500">
                      +{person.skills.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleOpenWorkspace(person)}
                  rightIcon={<ExternalLink className="w-3 h-3" />}
                  className="text-[11px]"
                >
                  Workspace
                </Button>

                <div className="flex items-center gap-1">
                  <Link to={`/people/${person.id}/edit`}>
                    <Button size="xs" variant="ghost" className="p-1.5" title="Edit Profile">
                      <Edit className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </Link>

                  {person.status === 'Active' || !person.status ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="p-1.5 text-amber-400 hover:bg-amber-950/30"
                      onClick={() => handleStatusChange(person, 'Inactive')}
                      title="Deactivate Account"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="p-1.5 text-emerald-400 hover:bg-emerald-950/30"
                      onClick={() => handleStatusChange(person, 'Active')}
                      title="Activate Account"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  <Button
                    size="xs"
                    variant="ghost"
                    className="p-1.5 text-rose-400 hover:bg-rose-950/30"
                    onClick={() => handleDelete(person)}
                    title="Delete Artist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
              <tr>
                <th className="py-3 px-4">Artist Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Facility Hub</th>
                <th className="py-3 px-4">Seniority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.map((person) => (
                <tr key={person.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <img src={person.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      <div>
                        <span
                          onClick={() => handleOpenWorkspace(person)}
                          className="font-bold text-white hover:text-indigo-300 cursor-pointer block"
                        >
                          {person.full_name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{person.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-200">{person.role}</td>
                  <td className="py-3 px-4 font-mono text-indigo-300">{person.department_name}</td>
                  <td className="py-3 px-4 text-slate-400">{person.office_name}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {person.seniority}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={person.status === 'Active' || !person.status ? 'success' : person.status === 'Suspended' ? 'danger' : 'warning'}
                      className="text-[10px] font-mono"
                    >
                      {person.status || 'Active'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleOpenWorkspace(person)}
                        className="text-[10px]"
                      >
                        Open
                      </Button>
                      <Link to={`/people/${person.id}/edit`}>
                        <Button size="xs" variant="ghost" className="p-1">
                          <Edit className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                      </Link>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="p-1 text-rose-400 hover:bg-rose-950/30"
                        onClick={() => handleDelete(person)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
