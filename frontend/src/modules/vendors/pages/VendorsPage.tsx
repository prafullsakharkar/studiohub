import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Search, Eye } from 'lucide-react';
import { useVendors } from '@/modules/vendors/hooks/useVendorsData';
import { useVendorMutations } from '@/modules/vendors/hooks/useVendorsData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { EmptyState } from '@/shared/components/EmptyState';

export const VendorsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useVendors();
  const { archiveVendor, restoreVendor } = useVendorMutations();

  const vendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.items ?? [];
    if (!q) return list;
    return list.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) ||
        v.code?.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Vendor Partners</h1>
            <Badge variant="outline" className="font-mono text-xs text-cyan-300 border-cyan-500/30">
              {data?.items?.length ?? 0} Approved
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Outsourcing partner facilities on the flat directory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="w-56"
          />
          <Link to="/vendors/new">
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Vendor
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12">
          <EmptyState
            icon={<Search className="w-6 h-6 text-slate-400" />}
            title={search ? 'No vendors match your search' : 'No vendors registered yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Enroll an outsourcing partner to track vendor deliverables.'
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white truncate">{vendor.name}</span>
                    {vendor.code && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/30 shrink-0">
                        {vendor.code}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {[vendor.city, vendor.country].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono shrink-0 ${
                    vendor.status === 'Approved Partner'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : vendor.status === 'Archived'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {vendor.status || 'Approved Partner'}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                {vendor.description || 'No description provided.'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                <Link to={`/vendors/${vendor.id}`}>
                  <Button size="xs" variant="outline" leftIcon={<Eye className="w-3 h-3" />}>
                    Open
                  </Button>
                </Link>
                <div className="flex items-center gap-2">
                  {vendor.status === 'Archived' ? (
                    <button
                      type="button"
                      onClick={() => restoreVendor.mutate(vendor.id)}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => archiveVendor.mutate(vendor.id)}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
