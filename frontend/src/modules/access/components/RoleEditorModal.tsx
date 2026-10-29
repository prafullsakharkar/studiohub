import React, { useState, useMemo } from 'react';
import {
  Shield,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Layers,
  Search,
  Filter,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import type { Role, RoleCategory } from '@/types/identity';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import {
  DOMAIN_PERMISSIONS_CATALOG,
  PERMISSION_DOMAINS,
  ACCESS_ROLE_TEMPLATES,
} from '@/core/access/domainPermissions';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { ProductionRoleSelect } from '@/modules/access/components/ProductionRoleSelect';
import type { PermissionDomain, PermissionActionType } from '@/types/identity';

interface RoleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleToEdit?: Role | null;
}

export const RoleEditorModal: React.FC<RoleEditorModalProps> = ({
  isOpen,
  onClose,
  roleToEdit,
}) => {
  const { user: currentUser } = useCurrentUser();

  const {
    createRole,
    editRole,
    setRolePermissionsBulk,
    getEffectiveRolePermissions,
  } = useAccessManagementStore();

  const isEditing = Boolean(roleToEdit);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RoleCategory>('custom');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<PermissionDomain | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<PermissionActionType | 'ALL'>('ALL');
  // Scoped production-role catalog seed (create mode only): picking a
  // position fills name/description so RBAC roles stay aligned with the
  // org's production role catalog. Remembers the last seeded title so a
  // manual rename is never clobbered.
  const [seededPositionId, setSeededPositionId] = useState('');
  const seededNameRef = React.useRef('');

  // Load existing role values when modal opens or roleToEdit changes
  React.useEffect(() => {
    if (isOpen) {
      if (roleToEdit) {
        setName(roleToEdit.name);
        setCode(roleToEdit.code);
        setDescription(roleToEdit.description || '');
        setCategory(roleToEdit.category || 'custom');
        const perms = getEffectiveRolePermissions(roleToEdit.id);
        setSelectedPermissions(perms);
      } else {
        setName('');
        setCode(`custom_role_${Date.now().toString().slice(-4)}`);
        setDescription('Custom enterprise role with tailored access matrix.');
        setCategory('custom');
        setSelectedPermissions([
          'project.view',
          'shot.view',
          'asset.view',
          'task.view',
          'task.update',
          'version.view',
          'review.view',
        ]);
        setSeededPositionId('');
        seededNameRef.current = '';
      }
    }
  }, [isOpen, roleToEdit]);

  // Filtered domain catalog
  const filteredCatalog = useMemo(() => {
    return DOMAIN_PERMISSIONS_CATALOG.filter((item) => {
      if (selectedDomain !== 'ALL' && item.domain !== selectedDomain) return false;
      if (actionTypeFilter !== 'ALL' && item.actionType !== actionTypeFilter) return false;
      if (
        searchQuery &&
        !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.code.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.description.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [selectedDomain, actionTypeFilter, searchQuery]);

  // Group filtered catalog by domain
  const domainGroups = useMemo(() => {
    const groups: Record<PermissionDomain, typeof filteredCatalog> = {} as any;
    filteredCatalog.forEach((p) => {
      if (!groups[p.domain]) {
        groups[p.domain] = [];
      }
      groups[p.domain].push(p);
    });
    return groups;
  }, [filteredCatalog]);

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleSeedFromPosition = (positionId: string, position?: { title?: string; description?: string }) => {
    setSeededPositionId(positionId);
    if (!position) return;
    const title = position.title || '';
    // Only overwrite a name that is still blank or still the previous seed.
    if (!name || name === seededNameRef.current) {
      setName(title);
    }
    seededNameRef.current = title;
    if (position.description) {
      setDescription(position.description);
    }
    if (category === 'custom') {
      setCategory('production');
    }
  };

  const toggleDomainAll = (domain: PermissionDomain) => {
    const domainPerms = DOMAIN_PERMISSIONS_CATALOG.filter((p) => p.domain === domain).map(
      (p) => p.code
    );
    const allSelected = domainPerms.every((p) => selectedPermissions.includes(p));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !domainPerms.includes(p)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...domainPerms])));
    }
  };

  const selectAll = () => {
    setSelectedPermissions(DOMAIN_PERMISSIONS_CATALOG.map((p) => p.code));
  };

  const clearAll = () => {
    setSelectedPermissions([]);
  };

  const applyTemplate = (templateId: string) => {
    const template = ACCESS_ROLE_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSelectedPermissions([...template.defaultPermissions]);
      if (!name) setName(`${template.name} (Custom)`);
      if (!description) setDescription(template.description);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const actor = {
      id: currentUser?.id || 'usr-001',
      name: currentUser?.full_name || 'Administrator',
      email: currentUser?.email || 'admin@studiohub.vfx',
    };

    if (isEditing && roleToEdit) {
      editRole(
        roleToEdit.id,
        {
          name: name.trim(),
          code: code.trim(),
          description: description.trim(),
          category,
          permissions: selectedPermissions,
        },
        actor
      );
      setRolePermissionsBulk(roleToEdit.id, selectedPermissions, actor);
    } else {
      createRole(
        {
          name: name.trim(),
          code: code.trim() || `role_${Date.now()}`,
          description: description.trim(),
          category,
          permissions: selectedPermissions,
          badge_color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        },
        actor
      );
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Enterprise Role: ${roleToEdit?.name}` : 'Create Enterprise Role'}
      subtitle={`Configure role-based access control across ${PERMISSION_DOMAINS.length} studio domains`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Role Core Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Role Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Comp Supervisor"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Unique Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. comp_supervisor"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-indigo-300 font-mono focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RoleCategory)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="organization">Organization / Executive</option>
              <option value="production">Production & Supervision</option>
              <option value="craft">Discipline / Craft</option>
              <option value="vendor">Vendor Studio</option>
              <option value="client">Client Partner</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational responsibilities and scope of access..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Quick Role Template Bar */}
        {!isEditing && (
          <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl">
            <ProductionRoleSelect
              value={seededPositionId}
              onChange={handleSeedFromPosition}
              required={false}
              id="role-catalog-seed"
            />
            <p className="text-[10px] text-slate-500 mt-1.5">
              Optional: seed this RBAC role from the studio production role catalog (master +
              custom roles).
            </p>
          </div>
        )}

        <div className="bg-indigo-950/20 border border-indigo-900/40 p-3 rounded-xl flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 mr-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Apply Template:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {ACCESS_ROLE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => applyTemplate(tmpl.id)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 hover:bg-indigo-900/40 text-slate-300 hover:text-indigo-200 border border-slate-800 transition-colors"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Permission Matrix Controls */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Domain Permission Matrix
              </h3>
              <Badge variant="neutral" className="text-[10px] font-mono">
                {selectedPermissions.length} / {DOMAIN_PERMISSIONS_CATALOG.length} Selected
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" size="xs" variant="outline" onClick={selectAll}>
                Select All
              </Button>
              <Button type="button" size="xs" variant="outline" onClick={clearAll}>
                Clear All
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search permissions..."
              className="w-full text-xs"
            />

            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300"
            >
              <option value="ALL">All Domains ({PERMISSION_DOMAINS.length})</option>
              {PERMISSION_DOMAINS.map((dom) => (
                <option key={dom} value={dom}>
                  {dom}
                </option>
              ))}
            </select>

            <select
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-slate-300"
            >
              <option value="ALL">All Action Types</option>
              <option value="view">View</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="archive">Archive</option>
              <option value="restore">Restore</option>
              <option value="delete">Delete</option>
              <option value="assign">Assign</option>
              <option value="unassign">Unassign</option>
              <option value="submit">Submit</option>
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="publish">Publish</option>
              <option value="ingest">Ingest</option>
              <option value="export">Export</option>
              <option value="import">Import</option>
              <option value="execute">Execute</option>
              <option value="sync">Sync</option>
              <option value="grant">Grant</option>
              <option value="revoke">Revoke</option>
              <option value="comment">Comment</option>
              <option value="download">Download</option>
              <option value="playback">Playback</option>
              <option value="bulk_create">Bulk Create</option>
              <option value="bulk_update">Bulk Update</option>
              <option value="bulk_archive">Bulk Archive</option>
              <option value="bulk_restore">Bulk Restore</option>
              <option value="bulk_delete">Bulk Delete</option>
              <option value="special">Special Actions</option>
            </select>
          </div>

          {/* Domain Permission Grid */}
          <div className="max-h-[420px] overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {Object.keys(domainGroups).length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 font-mono">
                No permissions matching search criteria.
              </div>
            ) : (
              (Object.keys(domainGroups) as PermissionDomain[]).map((domain) => {
                const perms = domainGroups[domain];
                const domainTotalPerms = DOMAIN_PERMISSIONS_CATALOG.filter(
                  (p) => p.domain === domain
                );
                const allSelected = domainTotalPerms.every((p) =>
                  selectedPermissions.includes(p.code)
                );
                const someSelected =
                  !allSelected &&
                  domainTotalPerms.some((p) => selectedPermissions.includes(p.code));

                return (
                  <div
                    key={domain}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 space-y-2.5"
                  >
                    {/* Domain Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleDomainAll(domain)}
                          className="text-slate-400 hover:text-white"
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : someSelected ? (
                            <div className="w-4 h-4 rounded bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                              <div className="w-2 h-0.5 bg-indigo-400" />
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                        <span className="text-xs font-bold text-white tracking-wide">{domain}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {domainTotalPerms.filter((p) => selectedPermissions.includes(p.code)).length}{' '}
                        / {domainTotalPerms.length}
                      </span>
                    </div>

                    {/* Permission Items in this domain */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {perms.map((perm) => {
                        const isSelected = selectedPermissions.includes(perm.code);
                        return (
                          <div
                            key={perm.id}
                            onClick={() => togglePermission(perm.code)}
                            className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                              isSelected
                                ? 'bg-indigo-950/30 border-indigo-500/40 text-white'
                                : 'bg-slate-950/40 border-slate-800/60 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="pt-0.5">
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-medium text-slate-200">
                                  {perm.name}
                                </span>
                                <Badge
                                  variant={
                                    perm.riskLevel === 'Critical'
                                      ? 'error'
                                      : perm.riskLevel === 'High'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                  className="text-[9px] px-1 py-0"
                                >
                                  {perm.actionType}
                                </Badge>
                              </div>
                              <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                {perm.description}
                              </p>
                              <span className="text-[9px] font-mono text-indigo-400/80">
                                {perm.code}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" leftIcon={<Check className="w-4 h-4" />}>
            {isEditing ? 'Save Role Changes' : 'Create Role'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
