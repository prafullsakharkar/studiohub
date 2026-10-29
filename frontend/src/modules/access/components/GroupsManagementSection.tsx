import { useGroups, useRoles } from '@/modules/access/hooks/useAccessData';
import { usePeople } from '@/modules/people';
import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import {
  Users2,
  Search,
  Plus,
  Edit,
  Trash2,
  Archive,
  RotateCcw,
  UserPlus,
  UserMinus,
  Shield,
  CheckCircle2,
  Users,
  ChevronRight,
  Layers,
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
import { groupsListConfig } from '@/modules/access/configs/listConfigs';
import { Modal } from '@/shared/components/Modal';
import type { AccessGroupItem } from '@/types/identity';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import type { Role } from '@/types/identity';

export const GroupsManagementSection: React.FC = () => {
  const { user: currentUser } = useCurrentUser();

  const { data: groupsData } = useGroups();
  const { data: peopleData } = usePeople();
  const { data: rolesData } = useRoles();

  const peopleList = useMemo(() => peopleData?.items || [], [peopleData]);
  const rolesList: Role[] = useMemo(() => (Array.isArray(rolesData) ? (rolesData as unknown as Role[]) : []), [rolesData]);

  const {
    groups: storeGroups,
    createGroup,
    editGroup,
    archiveGroup,
    restoreGroup,
    deleteGroup,
    addGroupMember,
    removeGroupMember,
    assignGroupRoles,
    getAllRoles,
  } = useAccessManagementStore();

  const orgGroups = useMemo(() => {
    // Store groups are the roster source (flat platform groups).
    return storeGroups;
  }, [storeGroups]);

  const allRoles: Role[] = useMemo(() => {
    if (rolesList.length > 0) {
      return rolesList.filter((r: Role) => !(r as any).is_archived);
    }
    return getAllRoles().filter((r: Role) => !r.is_archived);
  }, [rolesList, getAllRoles]);

  const [search, setSearch] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Archived'>('Active');

  // Unified shell state for the left roster. The group source stays
  // client-side (store-filtered, verbatim): search/sort/page below slice the
  // filtered list; the `useGroups` hook call is untouched (bare array).
  const { can } = useAuth();
  const [mode, setMode] = usePersistedViewMode(groupsListConfig.entityType);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);

  // Form states
  const [groupName, setGroupName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);
  // Users multi-select (crew members) for the Add Member modal.
  const [usersToAdd, setUsersToAdd] = useState<string[]>([]);

  const actor = {
    id: currentUser?.id || 'usr-001',
    name: currentUser?.full_name || 'Administrator',
    email: currentUser?.email || 'admin@studiohub.vfx',
  };

  const filteredGroups = useMemo(() => {
    return orgGroups.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (
        search &&
        !g.name.toLowerCase().includes(search.toLowerCase()) &&
        !g.code.toLowerCase().includes(search.toLowerCase()) &&
        !g.description.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [orgGroups, statusFilter, search]);

  useEffect(() => {
    if (filteredGroups.length > 0) {
      if (!selectedGroupId || !filteredGroups.some((g) => g.id === selectedGroupId)) {
        setSelectedGroupId(filteredGroups[0].id);
      }
    } else {
      setSelectedGroupId(null);
    }
  }, [filteredGroups, selectedGroupId]);

  const selectedGroup = useMemo(() => {
    return orgGroups.find((g) => g.id === selectedGroupId) || filteredGroups[0] || null;
  }, [orgGroups, selectedGroupId, filteredGroups]);

  const groupMembers = useMemo(() => {
    if (!selectedGroup) return [];
    return peopleList.filter((u) => selectedGroup.memberUserIds.includes(u.id));
  }, [selectedGroup, peopleList]);

  const availableUsersToAdd = useMemo(() => {
    if (!selectedGroup) return [];
    return peopleList.filter((u) => !selectedGroup.memberUserIds.includes(u.id));
  }, [selectedGroup, peopleList]);

  const handleOpenCreate = () => {
    setGroupName('');
    setGroupCode(`GRP-${Date.now().toString().slice(-4)}`);
    setGroupDescription('');
    setSelectedRoleNames(['Artist']);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    createGroup(
      {
        name: groupName.trim(),
        code: groupCode.trim(),
        description: groupDescription.trim(),
        roles: selectedRoleNames,
        memberUserIds: [],
      },
      actor
    );

    setIsCreateModalOpen(false);
  };

  const handleOpenEdit = (group: AccessGroupItem) => {
    setGroupName(group.name);
    setGroupCode(group.code);
    setGroupDescription(group.description);
    setSelectedRoleNames(group.roles);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !groupName.trim()) return;

    editGroup(
      selectedGroup.id,
      {
        name: groupName.trim(),
        code: groupCode.trim(),
        description: groupDescription.trim(),
      },
      actor
    );

    setIsEditModalOpen(false);
  };

  const handleAddMember = () => {
    if (!selectedGroup || usersToAdd.length === 0) return;
    usersToAdd.forEach((userId) => addGroupMember(selectedGroup.id, userId, actor));
    setUsersToAdd([]);
    setIsAddMemberModalOpen(false);
  };

  const handleRemoveMember = (userId: string) => {
    if (!selectedGroup) return;
    removeGroupMember(selectedGroup.id, userId, actor);
  };

  const handleSaveRoles = () => {
    if (!selectedGroup) return;
    assignGroupRoles(selectedGroup.id, selectedRoleNames, actor);
    setIsAssignRoleModalOpen(false);
  };

  const toggleRoleInGroup = (roleName: string) => {
    setSelectedRoleNames((prev) =>
      prev.includes(roleName) ? prev.filter((r) => r !== roleName) : [...prev, roleName]
    );
  };

  const handleDeleteGroup = (group: AccessGroupItem) => {
    if (confirm(`Permanently delete group "${group.name}"?`)) {
      deleteGroup(group.id, actor);
    }
  };

  const handleSortChange = (sorts: SortConfig[]) => {
    // The roster has no server sort contract: any table sort only resets
    // the page; client order (store order) is preserved verbatim.
    if (sorts.length > 0) setPage(1);
  };

  // Hidden-means-absent: denied actions never reach the table/card layer.
  // Edit/archive/restore/delete map to the existing store handlers; the
  // inspector and all four modals below stay verbatim.
  const rowActions = [
    {
      id: 'edit',
      label: 'Edit Group',
      icon: <Edit className="w-4 h-4" />,
      requiredPermission: groupsListConfig.permissions.update,
      action: (group: AccessGroupItem) => handleOpenEdit(group),
    },
    {
      id: 'archive',
      label: 'Archive Group',
      icon: <Archive className="w-4 h-4" />,
      requiredPermission: groupsListConfig.permissions.update,
      isVisible: (group: AccessGroupItem) => group.status !== 'Archived',
      action: (group: AccessGroupItem) => archiveGroup(group.id, actor),
    },
    {
      id: 'restore',
      label: 'Restore Group',
      icon: <RotateCcw className="w-4 h-4" />,
      requiredPermission: groupsListConfig.permissions.update,
      isVisible: (group: AccessGroupItem) => group.status === 'Archived',
      action: (group: AccessGroupItem) => restoreGroup(group.id, actor),
    },
    {
      id: 'delete',
      label: 'Delete Group',
      variant: 'danger',
      requiredPermission: groupsListConfig.permissions.delete,
      action: (group: AccessGroupItem) => handleDeleteGroup(group),
    },
  ].filter((a) => !a.requiredPermission || can(a.requiredPermission));

  const pagedGroups = filteredGroups.slice((page - 1) * pageSize, page * pageSize);

  const renderGroupCard = (group: (typeof filteredGroups)[number]) => {
    const isSelected = selectedGroup?.id === group.id;
    return (
      <div
        onClick={() => setSelectedGroupId(group.id)}
        className={`p-4 rounded-xl border transition-all cursor-pointer select-none space-y-3 h-full ${
          isSelected
            ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500/20'
            : 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/90'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{group.name}</span>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/50">
                {group.code}
              </span>
              {group.status === 'Archived' && (
                <Badge variant="warning" className="text-[9px]">
                  Archived
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">{group.description}</p>
          </div>

          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-transform ${
              isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600'
            }`}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs font-mono">
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span className="text-amber-400 font-semibold">{group.roles.join(', ')}</span>
            <span>•</span>
            <span>{group.memberUserIds.length} Members</span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {can(groupsListConfig.permissions.update) && (
              <button
                title="Edit Group" aria-label="Edit Group"
                onClick={() => handleOpenEdit(group)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}

            {can(groupsListConfig.permissions.update) &&
              (group.status === 'Archived' ? (
                <button
                  title="Restore Group" aria-label="Restore Group"
                  onClick={() => restoreGroup(group.id, actor)}
                  className="p-1 rounded hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  title="Archive Group" aria-label="Archive Group"
                  onClick={() => archiveGroup(group.id, actor)}
                  className="p-1 rounded hover:bg-amber-950 text-amber-400 hover:text-amber-300"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              ))}

            {can(groupsListConfig.permissions.delete) && (
              <button
                title="Delete Group" aria-label="Delete Group"
                onClick={() => handleDeleteGroup(group)}
                className="p-1 rounded hover:bg-rose-950 text-rose-400 hover:text-rose-300"
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
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search access groups..."
            className="w-64 text-xs"
          />

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="Active">Active Groups</option>
            <option value="Archived">Archived Groups</option>
            <option value="all">All Groups</option>
          </select>
        </div>

        {can(groupsListConfig.permissions.create) && (
          <Button
            size="xs"
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleOpenCreate}
          >
            Create Access Group
          </Button>
        )}
      </div>

      {/* Main Groups Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left List (unified shell; inspector on the right is verbatim) */}
        <div className="lg:col-span-6 space-y-2.5">
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
              ariaLabel="Group view mode"
            />
            {mode === 'grid' && (
              <SearchInput
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={groupsListConfig.searchPlaceholder}
                className="w-64 text-xs"
              />
            )}
          </div>

          {filteredGroups.length === 0 ? (
            <div className="text-center py-16 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs font-mono">
              No access groups found.
            </div>
          ) : mode === 'table' ? (
            <EntityTable<AccessGroupItem>
              data={pagedGroups}
              fields={groupsListConfig.fields}
              actions={rowActions}
              onRowClick={(group) => setSelectedGroupId(group.id)}
              selectedIds={selectedGroupId ? [selectedGroupId] : []}
              page={page}
              totalCount={filteredGroups.length}
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
              searchPlaceholder={groupsListConfig.searchPlaceholder}
              onSortChange={handleSortChange}
              emptyMessage="No access groups found."
            />
          ) : (
            <div className="max-h-[680px] overflow-y-auto pr-1 custom-scrollbar">
              <GridView<AccessGroupItem>
                data={pagedGroups}
                fields={groupsListConfig.fields}
                actions={rowActions}
                selectedIds={selectedGroupId ? [selectedGroupId] : []}
                onCardClick={(group) => setSelectedGroupId(group.id)}
                renderCard={renderGroupCard}
                emptyMessage="No access groups found."
              
              page={page}
              totalCount={filteredGroups.length}
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

        {/* Right Inspector & Member Roster */}
        <div className="lg:col-span-6">
          {selectedGroup ? (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Users2 className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-bold text-white">{selectedGroup.name}</h3>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                    {selectedGroup.description}
                  </div>
                </div>

                {can(groupsListConfig.permissions.update) && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      leftIcon={<Shield className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setSelectedRoleNames(selectedGroup.roles);
                        setIsAssignRoleModalOpen(true);
                      }}
                    >
                      Group Roles
                    </Button>

                    <Button
                      size="xs"
                      variant="primary"
                      disabled={availableUsersToAdd.length === 0}
                      leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setUsersToAdd([]);
                        setIsAddMemberModalOpen(true);
                      }}
                    >
                      Add Member
                    </Button>
                  </div>
                )}
              </div>

              {/* Group Assigned Roles */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-slate-400 uppercase">
                  Assigned Group Roles (Inherited by all members)
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedGroup.roles.map((r) => (
                    <span
                      key={r}
                      className="px-3 py-1 rounded-lg text-xs font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    Enrolled Members ({groupMembers.length})
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {groupMembers.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 font-mono rounded-xl bg-slate-950/40 border border-slate-800">
                      No members assigned to this group yet.
                    </div>
                  ) : (
                    groupMembers.map((member) => (
                      <div
                        key={member.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={member.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={member.full_name}
                            className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{member.full_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {member.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="neutral" className="text-[10px] font-mono">
                            {member.role}
                          </Badge>
                          {can(groupsListConfig.permissions.update) && (
                            <button
                              title="Remove Member from Group"
                              aria-label={`Remove ${member.full_name} from group`}
                              onClick={() => handleRemoveMember(member.id)}
                              className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500 font-mono">
              Select an access group to manage members and roles.
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Access Group"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Group Name</label>
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Asset Lookdev Squad"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Group Code</label>
              <input
                type="text"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={3}
                placeholder="Discipline function, unit focus, and purpose..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="xs" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button size="xs" variant="primary" type="submit">
                Create Group
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Group Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Access Group"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Group Name</label>
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Group Code</label>
              <input
                type="text"
                value={groupCode}
                onChange={(e) => setGroupCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="xs" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button size="xs" variant="primary" type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <Modal
          isOpen={isAddMemberModalOpen}
          onClose={() => setIsAddMemberModalOpen(false)}
          title={`Add Member to ${selectedGroup?.name}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Select available crew members to add to this access group:
            </p>

            {/* GroupMemberCreate: `user` is a user UUID FK — one row per
                picked member (addGroupMember dedups existing picks). */}
            <select
              multiple
              value={usersToAdd}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions).map((o) => o.value);
                setUsersToAdd(options);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white min-h-[160px]"
              aria-label="Select members to add"
            >
              {availableUsersToAdd.length === 0 ? (
                <option value="" disabled>
                  No available crew members
                </option>
              ) : (
                availableUsersToAdd.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.email}) — {u.role}
                  </option>
                ))
              )}
            </select>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setUsersToAdd([]);
                  setIsAddMemberModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                variant="primary"
                onClick={handleAddMember}
                disabled={usersToAdd.length === 0}
              >
                Add Member{usersToAdd.length > 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Group Roles Modal */}
      {isAssignRoleModalOpen && (
        <Modal
          isOpen={isAssignRoleModalOpen}
          onClose={() => setIsAssignRoleModalOpen(false)}
          title={`Configure Roles for ${selectedGroup?.name}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Select the roles that all members of this group will automatically inherit:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {allRoles.map((role) => {
                const isSelected = selectedRoleNames.includes(role.name);
                return (
                  <label
                    key={role.id}
                    onClick={() => toggleRoleInGroup(role.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500/60 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold">{role.name}</span>
                      <p className="text-[11px] text-slate-400">{role.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-amber-500 focus:ring-amber-500"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button size="xs" variant="outline" onClick={() => setIsAssignRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button size="xs" variant="primary" onClick={handleSaveRoles}>
                Save Group Roles
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

