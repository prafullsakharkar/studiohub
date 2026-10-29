import type React from 'react';
import { useState, useMemo } from 'react';
import {
  Lock,
  Search,
  Filter,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useAccessManagementStore } from '@/core/access/useAccessManagementStore';
import { DOMAIN_PERMISSIONS_CATALOG, PERMISSION_DOMAINS } from '@/core/access/domainPermissions';
import { SearchInput } from '@/shared/components/SearchInput';
import { Badge } from '@/shared/components/Badge';
import type { PermissionDomain, PermissionActionType } from '@/types/identity';

export const PermissionsCatalogSection: React.FC = () => {
  const { getAllRoles, getEffectiveRolePermissions } = useAccessManagementStore();
  const allRoles = getAllRoles();

  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<PermissionDomain | 'ALL'>('ALL');
  const [actionTypeFilter, setActionTypeFilter] = useState<PermissionActionType | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'Low' | 'Medium' | 'High' | 'Critical'>('ALL');

  // Compute roles map for each permission
  const rolesGrantingPerm = useMemo(() => {
    const map: Record<string, string[]> = {};
    DOMAIN_PERMISSIONS_CATALOG.forEach((p) => {
      const rolesWithPerm = allRoles
        .filter((r) => {
          const perms = getEffectiveRolePermissions(r.id);
          return perms.includes('*') || perms.includes(p.code) || perms.some((code) => code.endsWith('.*') && p.code.startsWith(code.replace('.*', '')));
        })
        .map((r) => r.name);
      map[p.code] = rolesWithPerm;
    });
    return map;
  }, [allRoles, getEffectiveRolePermissions]);

  const filteredPermissions = useMemo(() => {
    return DOMAIN_PERMISSIONS_CATALOG.filter((p) => {
      if (selectedDomain !== 'ALL' && p.domain !== selectedDomain) return false;
      if (actionTypeFilter !== 'ALL' && p.actionType !== actionTypeFilter) return false;
      if (riskFilter !== 'ALL' && p.riskLevel !== riskFilter) return false;
      if (
        search &&
        !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.code.toLowerCase().includes(search.toLowerCase()) &&
        !p.description.toLowerCase().includes(search.toLowerCase()) &&
        !p.domain.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [selectedDomain, actionTypeFilter, riskFilter, search]);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permissions by name, code or description..."
            className="w-72 text-xs"
          />

          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
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
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="ALL">All Actions</option>
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

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
            <option value="Critical">Critical Risk</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredPermissions.length} of {DOMAIN_PERMISSIONS_CATALOG.length} permissions
        </span>
      </div>

      {/* Permissions Table List */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Permission Name & Code</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">Granted By Roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No permissions found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredPermissions.map((perm) => {
                  const grantingRoles = rolesGrantingPerm[perm.code] || [];
                  return (
                    <tr key={perm.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{perm.name}</div>
                        <div className="text-[11px] font-mono text-indigo-400 mt-0.5">
                          {perm.code}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-md">
                          {perm.description}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {perm.domain}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <Badge variant="neutral" className="text-[10px] capitalize">
                          {perm.actionType}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            perm.riskLevel === 'Critical'
                              ? 'error'
                              : perm.riskLevel === 'High'
                              ? 'warning'
                              : 'neutral'
                          }
                          className="text-[10px]"
                        >
                          {perm.riskLevel}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {grantingRoles.slice(0, 3).map((r) => (
                            <span
                              key={r}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800"
                            >
                              {r}
                            </span>
                          ))}
                          {grantingRoles.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900/50">
                              +{grantingRoles.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
