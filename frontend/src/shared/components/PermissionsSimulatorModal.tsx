import React, { useState } from 'react';
import { Modal } from './Modal';
import { usePermissions } from '@/core/permissions/usePermissions';
import { ALL_RESOURCES, ALL_ACTIONS } from '@/core/permissions/enterprisePermissions';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, RotateCcw, AlertTriangle, Sparkles, Sliders } from 'lucide-react';
import { Button } from './Button';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface PermissionsSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionsSimulatorModal: React.FC<PermissionsSimulatorModalProps> = ({ isOpen, onClose }) => {
  const {
    currentRoleId,
    currentRole,
    roles,
    setRole,
    effectivePermissions,
    customOverrides,
    toggleCustomPermission,
    resetCustomOverrides,
    resetToDefault,
    hasPermission,
  } = usePermissions();

  const addNotification = useNotificationStore((s) => s.addNotification);
  const [activeTab, setActiveTab] = useState<'roles' | 'matrix' | 'overrides'>('roles');

  const handleRoleSelect = (roleId: string) => {
    setRole(roleId);
    const targetRole = roles.find((r) => r.id === roleId);
    addNotification({
      title: 'Role Simulator Updated',
      message: `Active user role switched to ${targetRole?.name}. Frontend UI controls adapted.`,
      type: 'info',
    });
  };

  const hasOverrides = Object.keys(customOverrides).length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enterprise Permissions & RBAC Simulator"
      subtitle="Test role-based access control and live permission gating for the interaction layer"
      size="xl"
    >
      <div className="space-y-6 py-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'roles'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Role Presets ({roles.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Permissions Matrix
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'overrides'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>Custom Overrides</span>
            {hasOverrides && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {hasOverrides && (
              <Button
                size="sm"
                variant="ghost"
                onClick={resetCustomOverrides}
                className="text-xs h-7 text-amber-400 hover:text-amber-300"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset Overrides
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={resetToDefault}
              className="text-xs h-7 border-slate-700 text-slate-300"
            >
              Reset to Executive
            </Button>
          </div>
        </div>

        {/* Current Active Role Banner */}
        <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Active Simulated Role:</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${currentRole.badgeColor}`}>
                  {currentRole.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{currentRole.description}</p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] font-mono text-slate-400">
              Effective Permissions: <strong className="text-indigo-300">{effectivePermissions.length}</strong>
            </span>
          </div>
        </div>

        {/* Tab 1: Roles Selection */}
        {activeTab === 'roles' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
            {roles.map((role) => {
              const isSelected = role.id === currentRoleId;
              return (
                <div
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-900/30 border-indigo-500 ring-1 ring-indigo-500/50 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-100">{role.name}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${role.badgeColor}`}>
                      {isSelected ? 'Active Role' : 'Select'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {role.description}
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1">
                    {role.permissions.slice(0, 4).map((p, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        {p}
                      </span>
                    ))}
                    {role.permissions.length > 4 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        +{role.permissions.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Permissions Matrix */}
        {activeTab === 'matrix' && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 sticky top-0 z-10 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Resource</th>
                  {ALL_ACTIONS.map((action) => (
                    <th key={action} className="p-3 text-center">
                      {action}
                    </th>
                  ))}
                  <th className="p-3 text-center">Wildcard (*)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ALL_RESOURCES.map((resource) => {
                  const hasWildcard = hasPermission(`${resource}.*`);
                  return (
                    <tr key={resource} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-200 capitalize">
                        {resource}
                      </td>
                      {ALL_ACTIONS.map((action) => {
                        const permKey = `${resource}.${action}`;
                        const allowed = hasPermission(permKey);
                        return (
                          <td key={action} className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCustomPermission(permKey)}
                              className="p-1 rounded hover:bg-slate-800 transition-colors inline-flex"
                              title={`Toggle ${permKey}`}
                            >
                              {allowed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-slate-600" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleCustomPermission(`${resource}.*`)}
                          className="p-1 rounded hover:bg-slate-800 transition-colors inline-flex"
                          title={`Toggle ${resource}.*`}
                        >
                          {hasWildcard ? (
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              FULL
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-500">
                              GATED
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Custom Overrides */}
        {activeTab === 'overrides' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Customize or revoke specific permissions for testing the exact UI controls, command disabling, and button gating.
            </p>

            {hasOverrides ? (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl divide-y divide-slate-800/60 max-h-[360px] overflow-y-auto">
                {Object.entries(customOverrides).map(([perm, granted]) => (
                  <div key={perm} className="p-3 flex items-center justify-between hover:bg-slate-800/30">
                    <span className="font-mono text-xs text-slate-200">{perm}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          granted
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {granted ? 'Explicitly Granted' : 'Explicitly Denied'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleCustomPermission(perm)}
                        className="text-xs h-7 px-2 text-slate-400"
                      >
                        Toggle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-slate-500">
                <Sliders className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                <p className="text-xs">No active custom overrides. The role preset applies directly.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Click any checkbox in the Permissions Matrix tab to toggle an override.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
