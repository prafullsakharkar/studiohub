import { KeyRound } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { PageShell, Table, inputClass } from '../components/ui';
import { useAllPermissions } from '../hooks/useIdentityData';
import { ACCESS_TABS } from '../routes';

/**
 * Read-only catalog of the permission codes the backend knows. The whole catalog (145 rows) is
 * loaded once and filtered here: the server's `?module=` filter rejects the modules it actually
 * seeds (docs/sync captures: `?module=shots` answers 400), so it cannot be used.
 */
export const PermissionsPage: React.FC = () => {
  const catalog = useAllPermissions();
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');

  const modules = useMemo(() => [...new Set((catalog.data ?? []).map((p) => p.module))].sort(), [catalog.data]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (catalog.data ?? []).filter((p) => (!module || p.module === module) && (!needle || p.code.toLowerCase().includes(needle) || (p.description ?? '').toLowerCase().includes(needle)));
  }, [catalog.data, search, module]);

  return (
    <PageShell title="Permissions" subtitle={`${catalog.data?.length ?? 0} permission codes. Roles grant them; the API checks them on every request.`} tabs={ACCESS_TABS}>
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search permission codes" aria-label="Search permissions" className="max-w-sm" />
        <select aria-label="Filter by module" className={`${inputClass()} sm:max-w-48`} value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">All modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <QueryBoundary
        isLoading={catalog.isLoading}
        error={catalog.error}
        onRetry={() => void catalog.refetch()}
        entityName="permissions"
        isEmpty={rows.length === 0}
        empty={{ title: 'No permissions match', description: 'Change the search or module filter.', icon: <KeyRound className="h-8 w-8" /> }}
      >
        <Table label="Permissions" columns={['Code', 'Module', 'Action', 'Type']}>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 font-mono text-slate-200">{p.code}</td>
              <td className="px-4 py-2 text-slate-300">{p.module}</td>
              <td className="px-4 py-2 text-slate-300">{p.action}</td>
              <td className="px-4 py-2">{p.is_system ? <Badge variant="purple">System</Badge> : <Badge variant="neutral">Custom</Badge>}</td>
            </tr>
          ))}
        </Table>
        <p className="text-[11px] text-slate-500">
          Showing {rows.length} of {catalog.data?.length ?? 0}
        </p>
      </QueryBoundary>
    </PageShell>
  );
};
