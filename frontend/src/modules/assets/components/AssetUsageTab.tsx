import React, { useState } from 'react';
import type { Asset } from '@/types/production';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Film, Clapperboard, ExternalLink, Search, Filter, Layers, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AssetUsageTabProps {
  asset: Asset;
}

export const AssetUsageTab: React.FC<AssetUsageTabProps> = ({ asset }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const shotUsages = [
    {
      id: 'shot-001',
      code: 'SQ01_SH010',
      sequence: 'SQ01',
      sequence_name: 'Opening Flight & Approach',
      frames: '1001-1086 (86f)',
      camera: 'Cam_Hero_35mm_Anamorphic',
      stage_lod: 'LOD0 (Hero High-Poly)',
      status: 'Approved',
      department: 'Lighting & Comp',
      lead_artist: 'Marcus Vance',
    },
    {
      id: 'shot-002',
      code: 'SQ01_SH020',
      sequence: 'SQ01',
      sequence_name: 'Cockpit View & Close Reaction',
      frames: '1001-1142 (142f)',
      camera: 'Cam_CloseUp_85mm',
      stage_lod: 'LOD0 (Hero High-Poly)',
      status: 'In Progress',
      department: 'Animation',
      lead_artist: 'Aria Chen',
    },
    {
      id: 'shot-003',
      code: 'SQ02_SH040',
      sequence: 'SQ02',
      sequence_name: 'Atmospheric Cloud Entry',
      frames: '1001-1054 (54f)',
      camera: 'Cam_Wide_24mm',
      stage_lod: 'LOD1 (Medium Range)',
      status: 'Pending Review',
      department: 'FX Simulation',
      lead_artist: 'Kai Thorne',
    },
    {
      id: 'shot-004',
      code: 'SQ03_SH090',
      sequence: 'SQ03',
      sequence_name: 'Hangar Landing Sequence',
      frames: '1001-1198 (198f)',
      camera: 'Cam_Dolly_50mm',
      stage_lod: 'LOD0 (Hero High-Poly)',
      status: 'In Progress',
      department: 'LookDev & Lighting',
      lead_artist: 'Elena Rostova',
    },
    {
      id: 'shot-005',
      code: 'SQ04_SH120',
      sequence: 'SQ04',
      sequence_name: 'Background Fleet Formation',
      frames: '1001-1250 (250f)',
      camera: 'Cam_UltraWide_18mm',
      stage_lod: 'LOD2 (Background Quads)',
      status: 'Not Started',
      department: 'Layout',
      lead_artist: 'David Mercer',
    },
  ];

  const filteredShots = shotUsages.filter(
    (s) =>
      s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sequence.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sequence_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-emerald-400" />
            Shot Instantiations & Stage Usage Matrix
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Active instances of <strong>{asset.name} ({asset.code})</strong> across sequences, shot layouts, and lighting turnovers
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter shots, sequences..."
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-mono">Referenced Shots</div>
          <div className="text-lg font-bold text-white font-mono mt-0.5">{shotUsages.length} Shots</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-mono">Sequences</div>
          <div className="text-lg font-bold text-cyan-400 font-mono mt-0.5">4 Sequences</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-mono">Hero Close-ups</div>
          <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">3 Shots (LOD0)</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="text-[11px] text-slate-400 font-mono">Total Screen Time</div>
          <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">730 Frames (~30.4s)</div>
        </div>
      </div>

      {/* Shots List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Shot Code</th>
                <th className="py-3 px-4">Sequence</th>
                <th className="py-3 px-4">Frame Range</th>
                <th className="py-3 px-4">Camera / View</th>
                <th className="py-3 px-4">LOD Used</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Workspace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredShots.map((shot) => (
                <tr key={shot.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                    <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
                    {shot.code}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <div>{shot.sequence}</div>
                    <div className="text-[10px] text-slate-500 font-sans">{shot.sequence_name}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{shot.frames}</td>
                  <td className="py-3 px-4 text-cyan-300 flex items-center gap-1">
                    <Camera className="w-3 h-3 text-slate-500" /> {shot.camera}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                      {shot.stage_lod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <div>{shot.department}</div>
                    <div className="text-[10px] text-slate-500 font-sans">{shot.lead_artist}</div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={shot.status as any} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link to={`/shots/${shot.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-indigo-400 hover:text-indigo-300">
                        Open Shot <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
