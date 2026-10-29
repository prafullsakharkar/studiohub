import { useRoles } from '@/modules/access/hooks/useAccessData';
import { usePeople } from '@/modules/people';
import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Search,
  Plus,
  Copy,
  Archive,
  RotateCcw,
  Trash2,
  Edit,
  Users,
  Users2,
  Film,
  Lock,
  Sparkles,
  ChevronRight,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { Role, RoleCategory } from '@/types/identity';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { EntityTable } from '@/shared/crud/EntityTable';
import { GridView } from '@/shared/views/views/GridView';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { usePersistedViewMode } from '@/shared/hooks/usePersistedViewMode';
import { useAuth } from '@/modules/auth';
import type { SortConfig } from '@/types/common';
import { rolesListConfig } from '@/modules/access/configs/listConfigs';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { ACCESS_ROLE_TEMPLATES, DOMAIN_PERMISSIONS_CATALOG } from '@/core/access/domainPermissions';
import { RoleEditorModal } from './RoleEditorModal';

export const RolesWorkspaceSection: React.FC = () => {
  const { user: currentUser } = useCurrentUser();

  const { data: peopleData } = usePeople();
  const { data: rolesData } = useRoles();

  const peopleList = useMemo(() => peopleData?.items || [], [peopleData]);
  const rolesList: Role[] = useMemo(() => (Array.isArray(rolesData) ? (rolesData as unknown as Role[]) : []), [rolesData]);

  const {
    getAllRoles,
    cloneRole,
    archiveRole,
    restoreRole,
    deleteRole,
    createRoleFromTemplate,
    getEffectiveRolePermissions,
    groups: storeGroups,
  } = useAccessManagementStore();

  const allRoles: Role[] = useMemo(() => {
    if (rolesList.length > 0) {
      return rolesList;
    }
    return getAllRoles();
  }, [rolesList, getAllRoles]);

  const orgGroups = useMemo(() => {
    // Store groups are the flat platform groups.
    return storeGroups;
  }, [storeGroups]);

  // Search, Filter, and Sort state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | RoleCategory>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'system' | 'custom'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'permissions'>('name');

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Unified shell state for the left roster. The role source stays
  // client-side (server bare-array + store fallback, verbatim): search/sort/
  // page below slice the merged list; the `useRoles` hook call is untouched.
  const { can } = useAuth();
  const [mode, setMode] = usePersistedViewMode(rolesListConfig.entityType);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Filtered & Sorted Roles
  const filteredRoles = useMemo(() => {
    return allRoles
      .filter((r) => {
        if (statusFilter === 'active' && r.is_archived) return false;
        if (statusFilter === 'archived' && !r.is_archived) return false;
        if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
        if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
        if (
          search &&
          !r.name.toLowerCase().includes(search.toLowerCase()) &&
          !r.code.toLowerCase().includes(search.toLowerCase()) &&
          !r.description?.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
        if (sortBy === 'permissions') {
          const permsA = getEffectiveRolePermissions(a.id).length;
          const permsB = getEffectiveRolePermissions(b.id).length;
          return permsB - permsA;
        }
        return 0;
      });
  }, [allRoles, statusFilter, categoryFilter, typeFilter, search, sortBy, getEffectiveRolePermissions]);

  useEffect(() => {
    if (filteredRoles.length > 0) {
      if (!selectedRoleId || !filteredRoles.some((r) => r.id === selectedRoleId)) {
        setSelectedRoleId(filteredRoles[0].id);
      }
    } else {
      setSelectedRoleId(null);
    }
  }, [filteredRoles, selectedRoleId]);

  const selectedRole = useMemo(() => {
    return allRoles.find((r) => r.id === selectedRoleId) || filteredRoles[0] || null;
  }, [allRoles, selectedRoleId, filteredRoles]);

  const selectedRolePermissions = useMemo(() => {
    if (!selectedRole) return [];
    return getEffectiveRolePermissions(selectedRole.id);
  }, [selectedRole, getEffectiveRolePermissions]);

  // Find users assigned to selected role
  const assignedUsers = useMemo(() => {
    if (!selectedRole) return [];
    return peopleList.filter(
      (u: any) =>
        u.role === selectedRole.name ||
        u.memberships?.some((m: any) => m.role === selectedRole.name) ||
        u.project_memberships?.some((p: any) => (p.roles || [p.role]).includes(selectedRole.name))
    );
  }, [selectedRole, peopleList]);

  // Find groups assigned to selected role
  const assignedGroups = useMemo(() => {
    if (!selectedRole) return [];
    return orgGroups.filter((g) => g.roles.includes(selectedRole.name));
  }, [selectedRole, orgGroups]);

  // Actor
  const actor = {
    id: currentUser?.id || 'usr-001',
    name: currentUser?.full_name || 'Administrator',
    email: currentUser?.email || 'admin@studiohub.vfx',
  };

  const handleOpenCreate = () => {
    setRoleToEdit(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setRoleToEdit(role);
    setIsEditorOpen(true);
  };

  const handleClone = (role: Role) => {
    const cloned = cloneRole(
      role.id,
      {
        name: `${role.name} (Custom Copy)`,
        code: `copy_${role.code}_${Date.now()}`,
        description: `Copy of ${role.name}. ${role.description || ''}`,
      },
      actor
    );
    setSelectedRoleId(cloned.id);
  };

  const handleArchive = (role: Role) => {
    archiveRole(role.id, actor);
  };

  const handleRestore = (role: Role) => {
    restoreRole(role.id, actor);
  };

  const handleDelete = (role: Role) => {
    if (confirm(`Are you sure you want to permanently delete custom role "${role.name}"?`)) {
      deleteRole(role.id, actor);
    }
  };

  const handleSortChange = (sorts: SortConfig[]) => {
    const [first] = sorts;
    if (!first) return;
    // The roster sort contract is name/category/permissions: map the table
    // sort onto it, ignore anything else (current sortBy survives).
    if (first.field === 'name' || first.field === 'category') setSortBy(first.field);
    setPage(1);
  };

  // Hidden-means-absent: denied actions never reach the table/card layer.
  // Clone/edit/archive/restore/delete map to the existing store handlers;
  // the RoleEditorModal and template modal below stay verbatim.
  const rowActions = [
    {
      id: 'clone',
      label: 'Clone Role',
      icon: <Copy className="w-4 h-4" />,
      requiredPermission: rolesListConfig.permissions.create,
      action: (role: Role) => handleClone(role),
    },
    {
      id: 'edit',
      label: 'Edit Permissions & Metadata',
      icon: <Edit className="w-4 h-4" />,
      requiredPermission: rolesListConfig.permissions.update,
      action: (role: Role) => handleOpenEdit(role),
    },
    {
      id: 'archive',
      label: 'Archive Role',
      icon: <Archive className="w-4 h-4" />,
      requiredPermission: rolesListConfig.permissions.update,
      isVisible: (role: Role) => !(role as { is_archived?: boolean }).is_archived,
      action: (role: Role) => handleArchive(role),
    },
    {
      id: 'restore',
      label: 'Restore Role',
      icon: <RotateCcw className="w-4 h-4" />,
      requiredPermission: rolesListConfig.permissions.update,
      isVisible: (role: Role) => !!(role as { is_archived?: boolean }).is_archived,
      action: (role: Role) => handleRestore(role),
    },
    {
      id: 'delete',
      label: 'Delete Custom Role',
      variant: 'danger',
      requiredPermission: rolesListConfig.permissions.delete,
      isVisible: (role: Role) => role.type === 'custom',
      action: (role: Role) => handleDelete(role),
    },
  ].filter((a) => !a.requiredPermission || can(a.requiredPermission));

  const pagedRoles = filteredRoles.slice((page - 1) * pageSize, page * pageSize);

  const renderRoleCard = (role: Role) => {
    const isSelected = selectedRole?.id === role.id;
    const perms = getEffectiveRolePermissions(role.id);
    return (
      <div
        onClick={() => setSelectedRoleId(role.id)}
        className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 h-full ${
          isSelected
            ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/20'
            : 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/90'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">{role.name}</span>
              {role.type === 'system' ? (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  System
                </span>
              ) : (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Custom
                </span>
              )}
              {(role as { is_archived?: boolean }).is_archived && (
                <Badge variant="warning" className="text-[9px]">
                  Archived
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">{role.description}</p>
          </div>

          <ChevronRight
            className={`w-4 h-4 transition-transform shrink-0 ${
              isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600'
            }`}
          />
        </div>

        {/* Metadata footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span className="text-indigo-400">{perms.length} Permissions</span>
            <span>•</span>
            <span className="capitalize text-slate-300">{role.category || 'General'}</span>
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {can(rolesListConfig.permissions.create) && (
              <button
                title="Clone Role" aria-label="Clone Role"
                onClick={() => handleClone(role)}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            {can(rolesListConfig.permissions.update) && (
              <button
                title="Edit Permissions & Metadata" aria-label="Edit Permissions & Metadata"
                onClick={() => handleOpenEdit(role)}
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}

            {can(rolesListConfig.permissions.update) &&
              ((role as { is_archived?: boolean }).is_archived ? (
                <button
                  title="Restore Role" aria-label="Restore Role"
                  onClick={() => handleRestore(role)}
                  className="p-1.5 rounded-md hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  title="Archive Role" aria-label="Archive Role"
                  onClick={() => handleArchive(role)}
                  className="p-1.5 rounded-md hover:bg-amber-950 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              ))}

            {can(rolesListConfig.permissions.delete) && role.type === 'custom' && (
              <button
                title="Delete Custom Role" aria-label="Delete Custom Role"
                onClick={() => handleDelete(role)}
                className="p-1.5 rounded-md hover:bg-rose-950 text-rose-400 hover:text-rose-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Action Header & Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search roles by name or code..."
            className="w-64 text-xs"
          />

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as any); setPage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="ALL">All Categories</option>
            <option value="organization">Organization</option>
            <option value="production">Production</option>
            <option value="craft">Craft & Artist</option>
            <option value="vendor">Vendor</option>
            <option value="client">Client</option>
            <option value="custom">Custom</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="ALL">All Types</option>
            <option value="system">System Roles</option>
            <option value="custom">Custom Roles</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="active">Active Roles</option>
            <option value="archived">Archived Roles</option>
            <option value="all">All Roles</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {can(rolesListConfig.permissions.create) && (
            <Button
              size="xs"
              variant="outline"
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
              onClick={() => setIsTemplateModalOpen(true)}
            >
              Deploy Template
            </Button>
          )}

          {can(rolesListConfig.permissions.create) && (
            <Button
              size="xs"
              variant="primary"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleOpenCreate}
            >
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* Main Roles Layout: Split List & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Roles List (unified shell; inspector on the right is verbatim) */}
        <div className="lg:col-span-7 space-y-2.5">
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
              ariaLabel="Role view mode"
            />
            {mode === 'grid' && (
              <SearchInput
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={rolesListConfig.searchPlaceholder}
                className="w-64 text-xs"
              />
            )}
          </div>

          {filteredRoles.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs font-mono">
              No access roles found matching criteria.
            </div>
          ) : mode === 'table' ? (
            <EntityTable<Role>
              data={pagedRoles}
              fields={rolesListConfig.fields}
              actions={rowActions}
              onRowClick={(role) => setSelectedRoleId(role.id)}
              selectedIds={selectedRoleId ? [selectedRoleId] : []}
              page={page}
              totalCount={filteredRoles.length}
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
              searchPlaceholder={rolesListConfig.searchPlaceholder}
              onSortChange={handleSortChange}
              emptyMessage="No access roles found matching criteria."
            />
          ) : (
            <div className="max-h-[680px] overflow-y-auto pr-1 custom-scrollbar">
              <GridView<Role>
                data={pagedRoles}
                fields={rolesListConfig.fields}
                actions={rowActions}
                selectedIds={selectedRoleId ? [selectedRoleId] : []}
                onCardClick={(role) => setSelectedRoleId(role.id)}
                renderCard={renderRoleCard}
                emptyMessage="No access roles found matching criteria."
              
              page={page}
              totalCount={filteredRoles.length}
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

        {/* Selected Role Inspector */}
        <div className="lg:col-span-5">
          {selectedRole ? (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 sticky top-4">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white">{selectedRole.name}</h3>
                  </div>
                  <div className="text-xs font-mono text-indigo-400 mt-0.5">
                    code: {selectedRole.code}
                  </div>
                </div>

                {can(rolesListConfig.permissions.update) && (
                  <Button
                    size="xs"
                    variant="outline"
                    leftIcon={<Edit className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenEdit(selectedRole)}
                  >
                    Edit Matrix
                  </Button>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Description</span>
                <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  {selectedRole.description || 'No description provided.'}
                </p>
              </div>

              {/* Assignment Associations */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    <span>Assigned Users</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">{assignedUsers.length}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Direct & project crew</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Users2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Assigned Groups</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">{assignedGroups.length}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Department units</div>
                </div>
              </div>

              {/* Assigned Users Roster preview */}
              {assignedUsers.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono text-slate-400 uppercase">Assigned Users</span>
                  <div className="flex flex-wrap gap-1.5">
                    {assignedUsers.map((u) => (
                      <span
                        key={u.id}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-950 text-slate-200 border border-slate-800 flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {u.full_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Effective Granted Permissions Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase">
                  <span>Granted Permissions ({selectedRolePermissions.length})</span>
                  <span className="text-indigo-400">Granular</span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 custom-scrollbar">
                  {selectedRolePermissions.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 font-mono">
                      No permissions granted to this role.
                    </div>
                  ) : (
                    selectedRolePermissions.map((code) => {
                      const def = DOMAIN_PERMISSIONS_CATALOG.find((p) => p.code === code);
                      return (
                        <div
                          key={code}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-900 transition-colors"
                        >
                          <span className="text-slate-200 font-medium">{def?.name || code}</span>
                          <span className="text-[10px] font-mono text-slate-500">{code}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 font-mono">
              Select a role to inspect permissions and assignments.
            </div>
          )}
        </div>
      </div>

      {/* Role Editor Modal */}
      <RoleEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        roleToEdit={roleToEdit}
      />

      {/* Deploy Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold">Deploy Canonical Role Template</h3>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select a template to generate a new editable custom role configured with domain-specific permissions and suggested production scopes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {ACCESS_ROLE_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{tmpl.name}</span>
                      <Badge variant="neutral" className="text-[9px] font-mono">
                        {tmpl.suggestedScope}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-indigo-400">
                      {tmpl.defaultPermissions.length} permissions
                    </span>
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => {
                        const created = createRoleFromTemplate(tmpl.id, undefined, actor);
                        setSelectedRoleId(created.id);
                        setIsTemplateModalOpen(false);
                      }}
                    >
                      Deploy
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
