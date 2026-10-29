import React from 'react';
import type { Asset } from '@/types/production';
import { SmartImg } from '@/components/ui/SmartImg';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Users, UserCheck, Shield, Sparkles, Box, Palette, Cpu, Scissors, Award } from 'lucide-react';

interface AssetAssignmentsTabProps {
  asset: Asset;
  onOpenAssign?: () => void;
}

export const AssetAssignmentsTab: React.FC<AssetAssignmentsTabProps> = ({
  asset,
  onOpenAssign,
}) => {
  const departmentCrew = [
    {
      department: '3D Modeling & Assets',
      role: 'Lead Modeler / Sculptor',
      artist: asset.assigned_artist_name || 'Sarah Jenkins',
      avatar: asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      status: 'Active',
      isPrimaryLead: true,
      dcc: `${asset.software || 'Maya'} / ZBrush`,
      hours: '42 hrs logged',
    },
    {
      department: 'LookDev & Shading',
      role: 'Senior LookDev TD',
      artist: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      status: 'Active',
      isPrimaryLead: false,
      dcc: 'Substance / Solaris (MaterialX)',
      hours: '36 hrs logged',
    },
    {
      department: 'Character & Creature Rigging',
      role: 'Lead Rigging TD',
      artist: 'Marcus Vance',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      status: 'In Progress',
      isPrimaryLead: false,
      dcc: 'Maya / USD Skel',
      hours: '28 hrs logged',
    },
    {
      department: 'CFX & Groom',
      role: 'Senior Grooming Artist',
      artist: 'Kai Thorne',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      status: 'Queued',
      isPrimaryLead: false,
      dcc: 'Houdini 20.5 (Karma Hair)',
      hours: '12 hrs logged',
    },
    {
      department: 'VFX Supervision',
      role: 'CG / Asset Supervisor',
      artist: 'Alex Chen',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      status: 'Sign-off',
      isPrimaryLead: false,
      dcc: 'OpenUSD Review / Nuke Studio',
      hours: '18 hrs logged',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Asset Department Roster & Staffing Allocations
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-department artists, TD leads, and supervisor sign-off roster for {asset.name} ({asset.code})
          </p>
        </div>

        {onOpenAssign && (
          <Button
            size="sm"
            variant="primary"
            onClick={onOpenAssign}
            leftIcon={<UserCheck className="w-3.5 h-3.5" />}
          >
            Assign / Reallocate Artist
          </Button>
        )}
      </div>

      {/* Roster Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {departmentCrew.map((crew) => (
          <div
            key={crew.department}
            className={`p-4 rounded-xl border transition-all ${
              crew.isPrimaryLead
                ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <SmartImg
                  src={crew.avatar}
                  alt={crew.artist}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-sm"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">{crew.artist}</span>
                    {crew.isPrimaryLead && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-0.5">
                        <Award className="w-3 h-3 text-emerald-400" /> Lead Artist
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 font-medium mt-0.5">{crew.role}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{crew.department}</div>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold border ${
                  crew.status === 'Active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : crew.status === 'Sign-off'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {crew.status}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1 text-slate-300">
                <Cpu className="w-3 h-3 text-cyan-400" /> {crew.dcc}
              </span>
              <span>{crew.hours}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Production Team Pod Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Assigned Production Pod & Schedule Quota
            </h4>
          </div>
          <Badge variant="outline" className="text-slate-300 font-mono text-[11px]">
            {asset.team_name || 'Hero Asset Crew'}
          </Badge>
        </div>

        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          This asset is actively scheduled in the <strong>{asset.team_name || 'Hero Asset Crew'}</strong> pod. All downstream shot handoffs to Layout, Animation, and Lighting are synchronized to the master USD stage reference pointer.
        </p>
      </div>
    </div>
  );
};
