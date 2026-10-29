import type React from 'react';
import { useState } from 'react';
import { Modal } from './Modal';
import { ShieldCheck, RotateCcw, Search, Check } from 'lucide-react';
import { usePermissionStore } from '@/shared/stores/usePermissionStore';
import { PERMISSION_CATALOG } from '@/core/permissions/permissionCatalog';
import { cn } from '@/shared/utils/cn';
import { notify } from '@/core/notifications/notify';

export interface PermissionsSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionsSimulatorModal: React.FC<PermissionsSimulatorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentRoleId,
    roles,
    customOverrides,
    isSimulating,
    setRole,
    toggleCustomPermission,
    resetCustomOverrides,
    resetToDefault,
    setIsSimulating,
    getActiveRole,
    hasPermission,
  } = usePermissionStore();

  const currentRole = getActiveRole();

  const [search, setSearch] = useState('');

  const handleRoleChange = (roleId: string) => {
    setRole(roleId);
    if (!isSimulating) {
      setIsSimulating(true);
    }
    notify.info(`Simulating permissions as: ${roles.find((r) => r.id === roleId || r.code === roleId)?.name || roleId}`);
  };

  const catalogPermissions = PERMISSION_CATALOG.map((p) => ({
    key: p.code,
    name: p.name,
    category: p.category,
    isGranted: hasPermission(p.code),
  }));

  const filteredPermissions = catalogPermissions.filter((item) =>
    item.key.toLowerCase().includes(search.toLowerCase()) ||
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <span>Role & Permissions Simulator</span>
        </div>
      }
      subtitle="Preview UI states, authorization scopes, and RBAC policies live in this session"
      size="xl"
    >
      <div className="space-y-6 py-2">
        {/* Role Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Simulated Role
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {roles.map((r) => {
              const isSelected = r.id === currentRoleId || r.code === currentRoleId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleChange(r.id)}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-semibold text-xs text-slate-100">{r.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <span className="text-[11px] text-slate-400 line-clamp-2">
                    {r.description || `Studio ${r.name} permissions`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Override controls */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Active Role: <span className="text-indigo-400">{currentRole?.name || currentRoleId}</span>
            </span>
            {isSimulating && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Simulation Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {customOverrides && Object.keys(customOverrides).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  resetCustomOverrides();
                  notify.info('Custom permission overrides cleared');
                }}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Overrides</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                resetToDefault();
                notify.info('Permissions reset to initial session default');
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>
        </div>

        {/* Permissions list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Effective Permission Matrix ({filteredPermissions.length})
            </h4>

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter permissions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {filteredPermissions.map(({ key: permKey, isGranted }) => {
              const hasOverride = customOverrides && customOverrides[permKey] !== undefined;

              return (
                <div
                  key={permKey}
                  onClick={() => toggleCustomPermission(permKey)}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none transition-colors text-xs',
                    isGranted
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                  )}
                >
                  <span className="font-mono text-[11px] truncate mr-2">{permKey}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasOverride && (
                      <span className="text-[10px] px-1 bg-amber-500/20 text-amber-300 rounded">
                        override
                      </span>
                    )}
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                        isGranted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      )}
                    >
                      {isGranted ? 'ALLOW' : 'DENY'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PermissionsSimulatorModal;
