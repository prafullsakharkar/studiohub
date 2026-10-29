import React from 'react';
import { Key, Check, CheckCircle2, Lock, Edit2, Copy } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { PERMISSION_CATALOG } from '@/core/permissions/permissionCatalog';

interface RoleDetailPanelProps {
  role: any | null;
  permissionsByCategory: Record<string, typeof PERMISSION_CATALOG>;
  onEdit: () => void;
  onDuplicate: () => void;
}

export const RoleDetailPanel: React.FC<RoleDetailPanelProps> = ({
  role,
  permissionsByCategory,
  onEdit,
  onDuplicate,
}) => {
  const activeRole = role;
  if (!activeRole) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
        Select a role to inspect its permissions matrix.
      </div>
    );
  }
  return (
    <>
            {activeRole ? (
              <Card className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="border-b border-slate-800 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Key className="w-5 h-5 text-amber-400" />
                        {activeRole.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono uppercase ${activeRole.badge_color || 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}
                      >
                        {activeRole.scope || 'Global Platform'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">{activeRole.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit()}
                      className="border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                      Edit Role & Perms
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDuplicate()}
                      className="border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      Clone
                    </Button>
                  </div>
                </CardHeader>

                <CardBody className="p-6 space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                        Authoritative Privileges Matrix
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-amber-300 border border-slate-700">
                        {activeRole.permissions?.includes('*')
                          ? 'Full Unrestricted Access (*)'
                          : `${activeRole.permissions?.length || 0} Capabilities Granted`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => {
                      const hasWildcard = activeRole.permissions?.includes('*');
                      const grantedCount = hasWildcard
                        ? perms.length
                        : perms.filter((p) => activeRole.permissions?.includes(p.code)).length;

                      return (
                        <div key={category} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-white font-mono uppercase tracking-wider">
                                {category}
                              </span>
                              <span className="text-xs font-mono text-slate-500">
                                ({grantedCount} / {perms.length} active)
                              </span>
                            </div>

                            {grantedCount === perms.length ? (
                              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Full Category
                              </span>
                            ) : grantedCount > 0 ? (
                              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                Partial
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-500">Restricted</span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {perms.map((perm) => {
                              const isGranted = hasWildcard || activeRole.permissions?.includes(perm.code);

                              return (
                                <div
                                  key={perm.id}
                                  className={`p-2.5 rounded border flex items-center justify-between text-xs transition ${
                                    isGranted
                                      ? 'bg-slate-900/90 border-slate-800 text-white'
                                      : 'bg-slate-950/40 border-slate-900/60 text-slate-600 opacity-60'
                                  }`}
                                >
                                  <div className="truncate mr-2">
                                    <span
                                      className={`font-mono block truncate font-semibold ${
                                        isGranted ? 'text-cyan-300' : 'text-slate-500'
                                      }`}
                                    >
                                      {perm.code}
                                    </span>
                                    <span className="text-[11px] text-slate-400 truncate block">{perm.name}</span>
                                  </div>
                                  {isGranted ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            ) : (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                Select a role to inspect its permissions matrix.
              </div>
            )}
    </>
  );
};
