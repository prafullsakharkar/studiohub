import React, { useState } from 'react';
import { Cpu, Plus, Search, ShieldCheck, Wifi, Star } from 'lucide-react';
import { Organization, Vendor } from '@/types/organization';
import { mockVendors } from '@/mocks/db/organization/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const VendorsTab: React.FC<{ org: Organization }> = ({ org }) => {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [search, setSearch] = useState('');

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.code.toLowerCase().includes(search.toLowerCase()) ||
      v.specialization.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Approved Outsourcing Labs & Specialized Vendor Partners
          </h2>
          <p className="text-xs text-slate-400">
            External roto, matchmove, prep, asset scan clean-up, and crowd simulation partners with MPAA Tier-4 clearance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-48"
            />
          </div>
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Enlist Vendor Partner
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((vendor) => (
          <div
            key={vendor.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={vendor.logo_url}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700 bg-slate-950 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">{vendor.name}</h3>
                    <span className="text-[9px] font-mono bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                      {vendor.code}
                    </span>
                  </div>
                  <span className="text-[11px] text-indigo-300 font-mono">{vendor.specialization}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{vendor.rating}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Security Clearance:</span>
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {vendor.security_tier}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Location Hub:</span>
                <span className="text-slate-300">{vendor.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Direct Bandwidth:</span>
                <span className="font-mono text-cyan-400">{vendor.bandwidth_gbps} Gbps Fiber Link</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Active Tasks: {vendor.active_tasks_count} Assigned</span>
              <span className="text-indigo-400 hover:underline cursor-pointer">Manage Outsource Portal</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
