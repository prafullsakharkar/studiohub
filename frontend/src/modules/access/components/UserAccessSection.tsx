import { useRoles, useGroups } from '@/modules/access/hooks/useAccessData';
import { usePeople } from '@/modules/people';
import { useProjects } from '@/modules/production';
import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Shield,
  Layers,
  Film,
  Building2,
  Users2,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
  Info,
  ExternalLink,
  Sparkles,
  UserPlus,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { EntityTable } from '@/shared/crud/EntityTable';
import { GridView } from '@/shared/views/views/GridView';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { usePersistedViewMode } from '@/shared/hooks/usePersistedViewMode';
import { useAuth } from '@/modules/auth';
import type { SortConfig } from '@/types/common';
import { usersListConfig } from '@/modules/access/configs/listConfigs';
import { Modal } from '@/shared/components/Modal';
import type { UserEffectiveAccess } from '@/types/identity';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import type { Role } from '@/types/identity';

export const UserAccessSection: React.FC = () => {
  const { user: currentUser } = useCurrentUser();

  const { data: peopleData, isLoading: isPeopleLoading } = usePeople();
  const { data: rolesData } = useRoles();
  const { data: groupsData } = useGroups();
  const { data: projectsData } = useProjects();

  const peopleList = useMemo(() => peopleData?.items || [], [peopleData]);
  const rolesList: Role[] = useMemo(() => (Array.isArray(rolesData) ? (rolesData as unknown as Role[]) : []), [rolesData]);
  const groupsList = useMemo(() => (Array.isArray(groupsData) ? groupsData : []), [groupsData]);
  const projectsList = useMemo(() => projectsData?.results || [], [projectsData]);

  const {
    getUserEffectiveAccess,
    assignUserProjectRole,
    getAllRoles,
  } = useAccessManagementStore();

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [isAssignProjectModalOpen, setIsAssignProjectModalOpen] = useState(false);
  const [newProjectRole, setNewProjectRole] = useState('Artist');
  const [newProjectId, setNewProjectId] = useState('');
  const [newProjectScope, setNewProjectScope] = useState('PROJECT');

  // Unified shell state for the left roster. The member source stays
  // client-side (people `.items`, verbatim): search/sort/page below slice
  // the filtered roster; hook calls are untouched (bare arrays preserved).
  const { can } = useAuth();
  const [mode, setMode] = usePersistedViewMode(usersListConfig.entityType);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (peopleList.length > 0 && (!selectedUserId || !peopleList.some((p) => p.id === selectedUserId))) {
      setSelectedUserId(peopleList[0].id);
    } else if (peopleList.length === 0) {
      setSelectedUserId('');
    }
  }, [peopleList, selectedUserId]);

  const allRoles: Role[] = useMemo(() => {
    if (rolesList.length > 0) {
      return rolesList.filter((r: Role) => !(r as any).is_archived);
    }
    return getAllRoles().filter((r: Role) => !r.is_archived);
  }, [rolesList, getAllRoles]);

  const filteredUsers = useMemo(() => {
    return peopleList.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.role?.toLowerCase().includes(search.toLowerCase()) ||
        (u.department_name && u.department_name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [peopleList, search]);

  const selectedPerson = useMemo(() => {
    return peopleList.find((u) => u.id === selectedUserId);
  }, [peopleList, selectedUserId]);

  const adaptedUser = useMemo(() => {
    if (!selectedPerson) return null;
    return {
      id: selectedPerson.id,
      email: selectedPerson.email,
      full_name: selectedPerson.full_name,
      role: selectedPerson.role,
      department: selectedPerson.department_name,
      avatar_url: selectedPerson.avatar_url,
      created_at: selectedPerson.created_at,
      project_memberships: [],
      memberships: [],
    };
  }, [selectedPerson]);

  const effectiveAccess: UserEffectiveAccess | null = useMemo(() => {
    if (!selectedUserId) return null;
    return getUserEffectiveAccess(selectedUserId, adaptedUser, projectsList);
  }, [selectedUserId, adaptedUser, projectsList, getUserEffectiveAccess]);

  const filteredEffectivePerms = useMemo(() => {
    if (!effectiveAccess) return [];
    if (!permissionSearch) return effectiveAccess.effectivePermissions;
    return effectiveAccess.effectivePermissions.filter((p) =>
      p.permissionCode.toLowerCase().includes(permissionSearch.toLowerCase())
    );
  }, [effectiveAccess, permissionSearch]);

  const actor = {
    id: currentUser?.id || 'usr-001',
    name: currentUser?.full_name || 'Administrator',
    email: currentUser?.email || 'admin@studiohub.vfx',
  };

  const handleSaveProjectRole = () => {
    if (!selectedUserId || !newProjectId) return;
    const targetProject = projectsList.find((p) => p.id === newProjectId);
    assignUserProjectRole(
      selectedUserId,
      newProjectId,
      newProjectRole,
      newProjectScope,
      {
        projectName: targetProject?.name,
        projectCode: targetProject?.code,
      },
      actor
    );
    setIsAssignProjectModalOpen(false);
  };

  const handleSortChange = (sorts: SortConfig[]) => {
    // The roster has no server sort contract: any table sort only resets
    // the page; client order (people order) is preserved verbatim.
    if (sorts.length > 0) setPage(1);
  };

  // Hidden-means-absent: denied actions never reach the table/card layer.
  // The roster surfaces inspect-only (selection drives the inspector);
  // no delete affordance (`deletable: false`).
  const rowActions = [
    {
      id: 'view',
      label: 'Inspect Access',
      requiredPermission: usersListConfig.permissions.view,
      action: (user: (typeof filteredUsers)[number]) => setSelectedUserId(user.id),
    },
  ].filter((a) => !a.requiredPermission || can(a.requiredPermission));

  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const renderUserCard = (user: (typeof filteredUsers)[number]) => {
    const isSelected = user.id === selectedUserId;
    return (
      <div
        onClick={() => setSelectedUserId(user.id)}
        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 h-full ${
          isSelected
            ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/20'
            : 'bg-slate-900/50 border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/80'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={user.full_name}
            className="w-9 h-9 rounded-xl object-cover bg-slate-950 ring-1 ring-slate-700 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{user.full_name}</div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <Badge variant="neutral" className="text-[10px] font-mono">
            {user.role}
          </Badge>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {user.department_name || 'Studio'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users by name, email, role..."
            className="w-72 text-xs"
          />
          <span className="text-xs font-mono text-slate-400">
            {filteredUsers.length} Users in Studio
          </span>
        </div>

        <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Real-time Permission Hierarchy & Scope Lineage</span>
        </div>
      </div>

      {/* Main Grid: User Roster & Effective Access Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: User Roster (unified shell; inspector stays verbatim) */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ScrollableTabs
              tabs={[
                { id: 'table', label: 'Table', icon: <List className="w-3.5 h-3.5" /> },
                { id: 'grid', label: 'Card', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
              ]}
              activeTab={mode}
              onTabChange={(t) => setMode(t as 'table' | 'grid')}
              variant="segments"
              showDropdown={false}
              ariaLabel="User view mode"
            />
            {mode === 'grid' && (
              <SearchInput
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={usersListConfig.searchPlaceholder}
                className="w-64 text-xs"
              />
            )}
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 font-mono space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p>No members found.</p>
            </div>
          ) : mode === 'table' ? (
            <EntityTable<(typeof filteredUsers)[number]>
              data={pagedUsers}
              fields={usersListConfig.fields}
              actions={rowActions}
              onRowClick={(user) => setSelectedUserId(user.id)}
              selectedIds={selectedUserId ? [selectedUserId] : []}
              page={page}
              totalCount={filteredUsers.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
              searchQuery={search}
              onSearchChange={(q) => {
                setSearch(q);
                setPage(1);
              }}
              searchPlaceholder={usersListConfig.searchPlaceholder}
              onSortChange={handleSortChange}
              emptyMessage="No members found."
            />
          ) : (
            <div className="max-h-[700px] overflow-y-auto pr-1 custom-scrollbar">
              <GridView<(typeof filteredUsers)[number]>
                data={pagedUsers}
                fields={usersListConfig.fields}
                actions={rowActions}
                selectedIds={selectedUserId ? [selectedUserId] : []}
                onCardClick={(user) => setSelectedUserId(user.id)}
                renderCard={renderUserCard}
                emptyMessage="No members found."
              
              page={page}
              totalCount={filteredUsers.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
/>
            </div>
          )}
        </div>

        {/* Right Column: User Effective Access Hierarchy */}
        <div className="lg:col-span-7">
          {effectiveAccess && selectedPerson ? (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              {/* User Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <img
                    src={selectedPerson.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={selectedPerson.full_name}
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-indigo-500/40"
                  />
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedPerson.full_name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                      <span>{selectedPerson.email}</span>
                      <span>•</span>
                      <span className="text-indigo-400">{effectiveAccess.userRole || selectedPerson.role}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {can(usersListConfig.permissions.update) && (
                    <Button
                      size="xs"
                      variant="secondary"
                      leftIcon={<Film className="w-3 h-3" />}
                      onClick={() => setIsAssignProjectModalOpen(true)}
                    >
                      Assign Project
                    </Button>
                  )}
                </div>
              </div>

              {/* Hierarchy Tree Visualizer */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Access Lineage Tree
                </span>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3 font-mono text-xs text-slate-300">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span>{selectedPerson.full_name}</span>
                  </div>

                  {/* Groups Node */}
                  <div className="pl-4 border-l-2 border-slate-800 space-y-1">
                    <div className="text-slate-300">├── Groups ({effectiveAccess.groups.length})</div>
                    {effectiveAccess.groups.map((g) => (
                      <div key={g.id} className="pl-4 text-slate-400 text-[11px]">
                        └── {g.name} <span className="text-amber-400">[{g.roles.join(', ')}]</span>
                      </div>
                    ))}
                    {effectiveAccess.groups.length === 0 && (
                      <div className="pl-4 text-slate-600 text-[11px]">└── No group memberships</div>
                    )}
                  </div>

                  {/* Projects Node */}
                  <div className="pl-4 border-l-2 border-slate-800 space-y-1">
                    <div className="text-slate-300">
                      └── Projects ({effectiveAccess.projectMemberships.length})
                    </div>
                    {effectiveAccess.projectMemberships.map((p) => (
                      <div key={p.projectId} className="pl-4 text-slate-400 text-[11px]">
                        └── {p.projectName} ({p.projectCode}) :{' '}
                        <span className="text-teal-400 font-semibold">{p.roles.join(', ')}</span>{' '}
                        <span className="text-slate-500">[Scope: {p.scope}]</span>
                      </div>
                    ))}
                    {effectiveAccess.projectMemberships.length === 0 && (
                      <div className="pl-4 text-slate-600 text-[11px]">└── No project assignments</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Effective Permissions Explanation List */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                      Effective Permissions ({effectiveAccess.effectivePermissions.length})
                    </h4>
                  </div>

                  <SearchInput
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                    placeholder="Filter permissions..."
                    className="w-48 text-xs"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 custom-scrollbar">
                  {filteredEffectivePerms.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 font-mono">
                      No effective permissions matched search.
                    </div>
                  ) : (
                    filteredEffectivePerms.map((p) => (
                      <div
                        key={p.permissionCode}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-indigo-300">
                            {p.permissionCode}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            GRANTED
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          {p.grantedBy.map((grant, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 font-mono">
                              <span className="text-slate-500">↳ Granted by:</span>
                              <span className="text-slate-200 font-medium">{grant.sourceName}</span>
                              <span className="text-slate-500">({grant.sourceType})</span>
                              <span className="text-slate-500">• Scope:</span>
                              <span className="text-teal-400">{grant.scope}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 font-mono">
              Select a crew member from the roster to inspect effective permissions.
            </div>
          )}
        </div>
      </div>

      {/* Assign Project Modal */}
      {isAssignProjectModalOpen && (
        <Modal
          isOpen={isAssignProjectModalOpen}
          onClose={() => setIsAssignProjectModalOpen(false)}
          title="Assign User to Project"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Target Project</label>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">Select a project…</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Project Role</label>
              <select
                value={newProjectRole}
                onChange={(e) => setNewProjectRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                {allRoles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Production Scope</label>
              <select
                value={newProjectScope}
                onChange={(e) => setNewProjectScope(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="PROJECT">PROJECT (Show-wide scope)</option>
                <option value="TEAM">TEAM (Squad / Unit scope)</option>
                <option value="ASSIGNED">ASSIGNED (Task-specific scope)</option>
                <option value="VENDOR">VENDOR (Vendor isolation scope)</option>
                <option value="CLIENT">CLIENT (Client screening scope)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="xs" variant="outline" onClick={() => setIsAssignProjectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="xs"
                variant="primary"
                onClick={handleSaveProjectRole}
                disabled={!newProjectId}
              >
                Assign Project Access
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

