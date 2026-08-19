import React, { useState } from 'react';
import { Globe, MapPin, Users, Wifi, Tv, Plus, CheckCircle2 } from 'lucide-react';
import { Organization, Office } from '@/types/organization';
import { mockOffices } from '@/mocks/db/organization/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const OfficesTab: React.FC<{ org: Organization }> = ({ org }) => {
  const [offices, setOffices] = useState<Office[]>(mockOffices);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            Global Facility Offices & Color Suites
          </h2>
          <p className="text-xs text-slate-400">
            Physical production hubs, synchronized SAN networks, and calibrated Barco / Flanders screening suites.
          </p>
        </div>

        <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Add Facility Office
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offices.map((office) => (
          <div
            key={office.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">{office.city}</h3>
                  <span className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                    {office.country}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">{office.timezone}</span>
              </div>
              <Badge variant="success" className="text-[9px] font-mono uppercase">
                {office.status}
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{office.address}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>
                  Occupancy: <strong className="text-white font-mono">{office.current_occupancy} / {office.capacity}</strong> workstations
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Tv className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>
                  Color Standard: <strong className="text-white font-mono">{office.color_space}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Wifi className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>
                  SAN Bandwidth: <strong className="text-indigo-300 font-mono">{office.network_speed_gbps} Gbps</strong>
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Lead: {office.manager_name}</span>
              <span className="text-indigo-400 hover:underline cursor-pointer">Configure Hub</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
