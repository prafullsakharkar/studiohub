import React, { useState } from 'react';
import {
  MapPin,
  Globe,
  Users,
  Zap,
  Clock,
  Tv,
  CheckCircle2,
  Building,
  Search,
  Sliders,
} from 'lucide-react';
import { useOffices } from '../hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';

export const OfficesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data: offices, isLoading } = useOffices();

  const filtered = (offices || []).filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.city.toLowerCase().includes(search.toLowerCase()) ||
      o.country.toLowerCase().includes(search.toLowerCase()) ||
      o.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Global Facilities & Offices</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {offices?.length || 0} Connected Sites
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Multi-site studio nodes, ultra-low latency sync grids, calibrated color grading suites, and capacity tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search facilities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-56"
            />
          </div>
        </div>
      </div>

      {/* Offices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((office) => {
          const occupancyRate = Math.round((office.current_occupancy / office.capacity) * 100);

          return (
            <div
              key={office.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">{office.name}</h3>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                        {office.code}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                      <Globe className="w-3 h-3 text-slate-500" />
                      {office.city}, {office.country}
                    </span>
                  </div>

                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono"
                  >
                    {office.status}
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 mt-2 line-clamp-1">{office.address}</p>

                {/* Metrics Bento */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      Network Backbone
                    </span>
                    <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                      {office.network_speed_gbps} Gbps Sync
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      Timezone
                    </span>
                    <span className="text-[11px] font-bold text-slate-300 font-mono mt-0.5 block truncate">
                      {office.timezone.split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div className="mt-4 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-sky-400" />
                      Site Occupancy
                    </span>
                    <span className="text-slate-200 font-semibold">
                      {office.current_occupancy} / {office.capacity} Seats ({occupancyRate}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>

                {/* Color Calibration */}
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-950/40 p-1.5 rounded border border-slate-800/40">
                  <Tv className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{office.color_space}</span>
                </div>
              </div>

              {/* Footer Lead */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Facility Lead: {office.manager_name}</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Online
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
