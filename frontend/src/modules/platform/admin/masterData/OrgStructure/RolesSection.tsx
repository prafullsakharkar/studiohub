import React, { useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  Shield,
  Plus,
  Key,
  Edit2,
  Trash2,
  Copy,
  Lock,
  CheckSquare,
  Square,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { PERMISSION_CATALOG } from '@/core/permissions/permissionCatalog';
import {
  usePlatformRoles,
  useCreatePlatformRole,
  useUpdatePlatformRole,
  useDeletePlatformRole,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { RoleDetailPanel } from './RoleDetailPanel';

const BADGE_COLOR_PRESETS = [
  { label: 'Amber (Super-Admin)', value: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { label: 'Cyan (Curator)', value: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { label: 'Purple (Security)', value: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { label: 'Indigo (Pipeline)', value: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { label: 'Emerald (Production)', value: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { label: 'Rose (Restricted)', value: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { label: 'Slate (Auditor)', value: 'bg-slate-700 text-slate-300 border-slate-600' },
];

export interface RolesSectionHandle {
  openCreate: () => void;
}

interface RolesSectionProps {
  searchQuery: string;
  hideHeaderCreateButton?: boolean;
}

export const RolesSection = forwardRef<RolesSectionHandle, RolesSectionProps>(({
  searchQuery,
  hideHeaderCreateButton = false,
}, ref) => {
  const { addNotification } = useNotificationStore();

  const { data: roles = [], isLoading: isRolesLoading } = usePlatformRoles();
  const createRoleMutation = useCreatePlatformRole();
  const updateRoleMutation = useUpdatePlatformRole();
  const deleteRoleMutation = useDeletePlatformRole();

  // Selected role for matrix detail view
  const [selectedRoleId, setSelectedRoleId] = useState<string>('platform_admin');

  // Modals state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    code: '',
    description: '',
    scope: 'Global Platform',
    badge_color: BADGE_COLOR_PRESETS[0].value,
    permissions: [] as string[],
  });
  const [permissionFilter, setPermissionFilter] = useState('');

  const [deleteRole, setDeleteRole] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: '',
  });

  // Effective selected role object
  const activeRole = useMemo(() => {
    return roles.find((r: any) => r.id === selectedRoleId) || roles[0] || null;
  }, [roles, selectedRoleId]);

  // Group permissions by category/resource for the matrix
  const permissionsByCategory = useMemo(() => {
    const categoriesMap: Record<string, typeof PERMISSION_CATALOG> = {};
    PERMISSION_CATALOG.forEach((perm) => {
      const cat = perm.category || perm.resource || 'General';
      const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
      if (!categoriesMap[formattedCat]) {
        categoriesMap[formattedCat] = [];
      }
      categoriesMap[formattedCat].push(perm);
    });
    return categoriesMap;
  }, []);

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(
      (r: any) =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.scope?.toLowerCase().includes(q)
    );
  }, [roles, searchQuery]);

  // ==========================================
  // HANDLERS: ROLES
  // ==========================================
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      name: '',
      code: '',
      description: '',
      scope: 'Global Platform',
      badge_color: BADGE_COLOR_PRESETS[0].value,
      permissions: ['platform.admin.view'],
    });
    setPermissionFilter('');
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: any) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name || '',
      code: role.code || '',
      description: role.description || '',
      scope: role.scope || 'Global Platform',
      badge_color: role.badge_color || BADGE_COLOR_PRESETS[0].value,
      permissions: role.permissions ? [...role.permissions] : [],
    });
    setPermissionFilter('');
    setIsRoleModalOpen(true);
  };

  const handleDuplicateRole = (role: any) => {
    const cloneData = {
      name: `${role.name} (Copy)`,
      code: `${role.code || 'ROLE'}_COPY_${Date.now().toString().slice(-3)}`,
      description: `Cloned derivative from ${role.name}. ${role.description || ''}`,
      scope: role.scope || 'Global Platform',
      badge_color: role.badge_color || BADGE_COLOR_PRESETS[3].value,
      permissions: role.permissions ? [...role.permissions] : [],
    };
    createRoleMutation.mutate(cloneData, {
      onSuccess: (newRole) => {
        addNotification({
          type: 'success',
          title: 'Role Duplicated',
          message: `Successfully duplicated '${role.name}' as '${cloneData.name}'.`,
        });
        if (newRole?.id) setSelectedRoleId(newRole.id);
      },
      onError: (err: any) => {
        addNotification({
          type: 'error',
          title: 'Duplication Failed',
          message: err?.message || 'Failed to clone role.',
        });
      },
    });
  };

  const handleSubmitRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.name.trim()) return;

    if (editingRole) {
      updateRoleMutation.mutate(
        { id: editingRole.id, data: roleFormData },
        {
          onSuccess: () => {
            addNotification({
              type: 'success',
              title: 'Role Updated',
              message: `Platform role '${roleFormData.name}' saved successfully.`,
            });
            setIsRoleModalOpen(false);
          },
          onError: (err: any) => {
            addNotification({
              type: 'error',
              title: 'Update Failed',
              message: err?.message || 'Could not update role.',
            });
          },
        }
      );
    } else {
      createRoleMutation.mutate(roleFormData, {
        onSuccess: (newRole) => {
          addNotification({
            type: 'success',
            title: 'Role Created',
            message: `Platform role '${roleFormData.name}' registered successfully.`,
          });
          setIsRoleModalOpen(false);
          if (newRole?.id) setSelectedRoleId(newRole.id);
        },
        onError: (err: any) => {
          addNotification({
            type: 'error',
            title: 'Creation Failed',
            message: err?.message || 'Could not create role.',
          });
        },
      });
    }
  };

  // ==========================================
  // PERMISSION TOGGLE HELPERS (FOR ROLE MODAL)
  // ==========================================
  const togglePermission = (code: string) => {
    setRoleFormData((prev) => {
      const exists = prev.permissions.includes(code);
      return {
        ...prev,
        permissions: exists ? prev.permissions.filter((p) => p !== code) : [...prev.permissions, code],
      };
    });
  };

  const toggleCategoryPermissions = (categoryPerms: typeof PERMISSION_CATALOG) => {
    setRoleFormData((prev) => {
      const allSelected = categoryPerms.every((p) => prev.permissions.includes(p.code) || prev.permissions.includes('*'));
      if (allSelected) {
        const catCodes = new Set(categoryPerms.map((p) => p.code));
        return {
          ...prev,
          permissions: prev.permissions.filter((p) => !catCodes.has(p)),
        };
      } else {
        const newPerms = new Set(prev.permissions);
        categoryPerms.forEach((p) => newPerms.add(p.code));
        return {
          ...prev,
          permissions: Array.from(newPerms),
        };
      }
    });
  };

  const handleDeleteRole = () => {
    if (!deleteRole.id) return;
    deleteRoleMutation.mutate(deleteRole.id, {
      onSuccess: () => {
        addNotification({
          type: 'success',
          title: 'Role Deleted',
          message: `'${deleteRole.title}' was removed successfully.`,
        });
        setDeleteRole({ isOpen: false, id: '', title: '' });
      },
      onError: (err: any) => {
        addNotification({
          type: 'error',
          title: 'Deletion Failed',
          message: err?.message || 'Failed to delete role.',
        });
      },
    });
  };

  useImperativeHandle(ref, () => ({
    openCreate: handleOpenCreateRole,
  }));

  return (
    <div className="space-y-6">
      {!hideHeaderCreateButton && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            Platform Roles ({roles.length})
          </h3>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateRole}
            className="whitespace-nowrap bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-0 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Role
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Roles List Panel */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                Configured Roles ({filteredRoles.length})
              </h3>
            </div>

            {isRolesLoading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading platform roles...</div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <Shield className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No roles matching filter.</p>
                <Button variant="outline" size="sm" onClick={handleOpenCreateRole}>
                  Create New Role
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRoles.map((r: any) => {
                  const isSelected = activeRole?.id === r.id;
                  const isSystem = r.is_system || r.id === 'platform_admin' || r.id === 'master_data_curator' || r.id === 'platform_viewer';

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRoleId(r.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer relative group ${
                        isSelected
                          ? 'bg-slate-850 border-amber-500/60 shadow-lg ring-1 ring-amber-500/30'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{r.name}</span>
                            {isSystem && (
                              <span title="System Role" className="text-amber-400">
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 block">{r.code || r.id}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase shrink-0 ${r.badge_color || 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}
                        >
                          {r.scope || 'Platform'}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{r.description}</p>

                      <div className="flex items-center justify-between text-xs font-mono text-slate-500 mt-3 pt-3 border-t border-slate-800/80">
                        <span className="flex items-center gap-1.5">
                          <Key className="w-3 h-3 text-amber-400/80" />
                          {r.permissions?.includes('*') ? 'All (*)' : `${r.permissions?.length || 0} perms`}
                        </span>

                        {/* Action buttons on hover/select */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Edit Role"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditRole(r);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Duplicate Role"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateRole(r);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {!isSystem && (
                            <button
                              type="button"
                              title="Delete Role"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteRole({ isOpen: true, id: r.id, title: r.name });
                              }}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        <div className="lg:col-span-8">
          <RoleDetailPanel
            role={activeRole}
            permissionsByCategory={permissionsByCategory}
            onEdit={() => activeRole && handleOpenEditRole(activeRole)}
            onDuplicate={() => activeRole && handleDuplicateRole(activeRole)}
          />
        </div>
      </div>

      {isRoleModalOpen && (
        <Modal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create Platform Role'}
          size="2xl"
        >
          <form onSubmit={handleSubmitRole} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Role Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pipeline Technical Director"
                  value={roleFormData.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const autoCode = val.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/(^_|_$)/g, '');
                    setRoleFormData({
                      ...roleFormData,
                      name: val,
                      code: roleFormData.code || autoCode,
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Code Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="PIPELINE_TD"
                  value={roleFormData.code}
                  onChange={(e) => setRoleFormData({ ...roleFormData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Scope Category</label>
                <select
                  value={roleFormData.scope}
                  onChange={(e) => setRoleFormData({ ...roleFormData, scope: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Global Platform">Global Platform</option>
                  <option value="Master Catalog">Master Catalog</option>
                  <option value="Studio Tenant">Studio Tenant</option>
                  <option value="Project Scoped">Project Scoped</option>
                  <option value="Global Read-Only">Global Read-Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Badge Color Theme</label>
                <select
                  value={roleFormData.badge_color}
                  onChange={(e) => setRoleFormData({ ...roleFormData, badge_color: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {BADGE_COLOR_PRESETS.map((preset) => (
                    <option key={preset.label} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Describe the operational responsibilities and authority bounds of this role."
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Permission Matrix Selector */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    Permission Entitlements ({roleFormData.permissions.includes('*') ? 'All (*)' : roleFormData.permissions.length} selected)
                  </h4>
                  <p className="text-[11px] text-slate-500">Toggle privileges granted directly to users holding this role.</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-40">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter perms..."
                      value={permissionFilter}
                      onChange={(e) => setPermissionFilter(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (roleFormData.permissions.length === PERMISSION_CATALOG.length) {
                        setRoleFormData({ ...roleFormData, permissions: [] });
                      } else {
                        setRoleFormData({ ...roleFormData, permissions: PERMISSION_CATALOG.map((p) => p.code) });
                      }
                    }}
                    className="px-2 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-700 transition"
                  >
                    {roleFormData.permissions.length === PERMISSION_CATALOG.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                {Object.entries(permissionsByCategory).map(([category, perms]) => {
                  const filteredCategoryPerms = perms.filter(
                    (p) =>
                      !permissionFilter.trim() ||
                      p.code.toLowerCase().includes(permissionFilter.toLowerCase()) ||
                      p.name.toLowerCase().includes(permissionFilter.toLowerCase())
                  );

                  if (filteredCategoryPerms.length === 0) return null;

                  const allCatSelected = filteredCategoryPerms.every((p) =>
                    roleFormData.permissions.includes(p.code) || roleFormData.permissions.includes('*')
                  );

                  return (
                    <div key={category} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleCategoryPermissions(filteredCategoryPerms)}
                          className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 hover:underline"
                        >
                          {allCatSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          {category}
                        </button>
                        <span className="text-[10px] font-mono text-slate-500">
                          {filteredCategoryPerms.filter((p) => roleFormData.permissions.includes(p.code)).length} /{' '}
                          {filteredCategoryPerms.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {filteredCategoryPerms.map((perm) => {
                          const isChecked =
                            roleFormData.permissions.includes(perm.code) || roleFormData.permissions.includes('*');

                          return (
                            <label
                              key={perm.id}
                              onClick={(e) => {
                                e.preventDefault();
                                togglePermission(perm.code);
                              }}
                              className={`p-2 rounded border flex items-center gap-2 text-xs cursor-pointer transition select-none ${
                                isChecked
                                  ? 'bg-amber-500/10 border-amber-500/30 text-white'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                              />
                              <div className="truncate">
                                <span className={`font-mono block truncate ${isChecked ? 'text-cyan-300 font-semibold' : 'text-slate-400'}`}>
                                  {perm.code}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate">{perm.name}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setIsRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createRoleMutation.isPending || updateRoleMutation.isPending}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-0"
              >
                {editingRole ? 'Save Changes' : 'Create Role'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteRole.isOpen && (
        <Modal
          isOpen={deleteRole.isOpen}
          onClose={() => setDeleteRole({ isOpen: false, id: '', title: '' })}
          title="Delete Role"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-white">Are you sure you want to delete '{deleteRole.title}'?</p>
                <p>
                  This action will permanently remove the role from platform master registries and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteRole({ isOpen: false, id: '', title: '' })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteRole}
                isLoading={deleteRoleMutation.isPending}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
});
