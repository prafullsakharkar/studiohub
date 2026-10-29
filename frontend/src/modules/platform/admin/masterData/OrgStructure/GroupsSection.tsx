import React, { useMemo, forwardRef } from 'react';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { usePlatformGroups } from '@/core/masterData/useMasterData';

export interface GroupsSectionHandle {
  // Read-only catalog: no imperative actions. Kept for tab-handle uniformity.
  readonly?: never;
}

interface GroupsSectionProps {
  searchQuery: string;
}

export const GroupsSection = forwardRef<GroupsSectionHandle, GroupsSectionProps>(({
  searchQuery,
}, _ref) => {
  const { data: groups = [], isLoading: isGroupsLoading } = usePlatformGroups();

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g: any) =>
        g.name?.toLowerCase().includes(q) ||
        g.code?.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        (g.roles && g.roles.some((r: string) => r.toLowerCase().includes(q)))
    );
  }, [groups, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200">
        <Users className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-white">Platform group templates (read-only catalog).</p>
          <p>
            Organization access groups are managed in{' '}
            <Link to="/access/groups" className="underline font-semibold">
              Manage in Access
            </Link>
            .
          </p>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Access Groups & Role Mapping
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Organizational group assignments aggregating multiple platform roles and scopes.
            </p>
          </div>
        </CardHeader>
        <CardBody className="p-0 overflow-x-auto">
          {isGroupsLoading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading access groups...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No access groups found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Group Name</th>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Mapped Roles</th>
                  <th className="py-3.5 px-4 text-center">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredGroups.map((g: any) => (
                  <tr key={g.id} className="hover:bg-slate-800/40 transition group">
                    <td className="py-4 px-6 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                        {g.name}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-purple-300">{g.code}</td>
                    <td className="py-4 px-4 text-xs text-slate-400 max-w-xs truncate">{g.description}</td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {g.roles && g.roles.length > 0 ? (
                          g.roles.map((r: string) => (
                            <Badge key={r} variant="outline" className="text-xs bg-slate-950 text-slate-300 border-slate-800">
                              {r}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">No roles mapped</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-slate-300">
                      <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono">
                        {g.member_count || g.memberCount || 0} users
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
});
