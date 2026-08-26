import React from 'react';
import { Cpu, Tv, Monitor, Wifi, CheckCircle2, AlertCircle } from 'lucide-react';
import { OfficeEntity } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const OfficeResourcesTab: React.FC<{ office: OfficeEntity }> = ({ office }) => {
  const resources = [
    {
      id: 'res-1',
      name: '4K DCI Laser Screening Room (Theater A)',
      type: 'Screening Facility',
      status: 'Online',
      specs: 'Christie 4K RGB Laser, Dolby Atmos 7.1.4, 28 seats',
    },
    {
      id: 'res-2',
      name: 'Local Render Cluster (Rack 01-08)',
      type: 'Compute Farm',
      status: 'Online',
      specs: `${office.render_nodes_count || 320} Nodes (Dual AMD EPYC, 256GB RAM, RTX 4090)`,
    },
    {
      id: 'res-3',
      name: 'Color Grading Suite (DI Bay 1)',
      type: 'Post-Production',
      status: 'Online',
      specs: 'Sony BVM-HX310 Master Monitor, DaVinci Advanced Panel',
    },
    {
      id: 'res-4',
      name: 'Motion Capture / Virtual Production Volume',
      type: 'Stage Resource',
      status: 'Scheduled',
      specs: 'Vicon Vantage 16-cam array, 8m x 6m LED volume',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Facility Hardware & Specialized Studio Infrastructure
          </h3>
          <p className="text-xs text-slate-400">
            Screening suites, localized compute clusters, and calibrated review theaters in {office.name}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((res) => (
          <div key={res.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-sm text-white">{res.name}</h4>
                <span className="text-xs text-indigo-300 font-mono">{res.type}</span>
              </div>
              <Badge variant={res.status === 'Online' ? 'success' : 'warning'} className="text-[10px] font-mono">
                {res.status}
              </Badge>
            </div>

            <p className="text-xs text-slate-400 font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              {res.specs}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
