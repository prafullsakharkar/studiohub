import React from 'react';
import type { Asset } from '@/types/production';
import { History, CheckCircle2, GitCommit, Award, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Badge } from '@/shared/components/Badge';

interface AssetHistoryTabProps {
  asset: Asset;
}

export const AssetHistoryTab: React.FC<AssetHistoryTabProps> = ({ asset }) => {
  const milestones = [
    {
      id: 'm-01',
      title: 'Master LookDev & ACEScg Shaders Sign-off',
      date: '2026-08-20 14:15',
      author: 'Alex Chen (VFX Supervisor)',
      status: 'Approved',
      version: asset.version || 'v009',
      description:
        'Final LookDev turntable passed dailies review. Approved for downstream lighting handoff across SQ01, SQ02, SQ03.',
      icon: Award,
      color: 'text-emerald-400',
    },
    {
      id: 'm-02',
      title: 'OpenUSD SubD Topology & Multi-LOD Cache Released',
      date: '2026-08-18 11:30',
      author: 'Sarah Jenkins (Lead Modeler)',
      status: 'Published',
      version: 'v008',
      description:
        'Subdivision hierarchy locked at 1.5M Tris for LOD0. LOD1-LOD3 decimation levels generated for background set dressing.',
      icon: CheckCircle2,
      color: 'text-cyan-400',
    },
    {
      id: 'm-03',
      title: 'USD Skel Rigging & Skinning Hierarchy Verified',
      date: '2026-08-14 09:45',
      author: 'Marcus Vance (Lead Rigging TD)',
      status: 'Verified',
      version: 'v006',
      description:
        'Hydraulic piston deformers and blendshape targets validated under extreme poses. Zero joint flip anomalies.',
      icon: ShieldCheck,
      color: 'text-indigo-400',
    },
    {
      id: 'm-04',
      title: 'High-Poly Concept Sculpt & Design Approval',
      date: '2026-08-05 16:00',
      author: 'Director / Art Dept',
      status: 'Approved',
      version: 'v001',
      description:
        'ZBrush digital clay sculpt approved. Silhouette, proportions, and mechanical cockpit detailing locked.',
      icon: CheckCircle2,
      color: 'text-purple-400',
    },
    {
      id: 'm-05',
      title: 'Asset Inception & Stage Registration',
      date: '2026-07-28 10:00',
      author: 'Pipeline TD',
      status: 'Registered',
      version: 'v000',
      description: `Asset container registered at ${asset.usd_prim_path || `/World/Assets/${asset.code}`}.`,
      icon: GitCommit,
      color: 'text-slate-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            Asset Production Milestone History & Provenance
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Key stage releases, supervisor milestones, and pipeline certifications for {asset.name}
          </p>
        </div>

        <Badge variant="outline" className="text-emerald-400 font-mono text-[11px] border-emerald-500/30">
          5 Milestones Recorded
        </Badge>
      </div>

      {/* Milestones Timeline */}
      <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-3">
        {milestones.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.id} className="relative group">
              {/* Timeline dot */}
              <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-emerald-400 group-hover:scale-125 transition-transform flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${m.color}`} />
                    <span className="text-xs font-bold text-white">{m.title}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">({m.version})</span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 self-end sm:self-center">
                    <Clock className="w-3 h-3 text-slate-500" /> {m.date}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Recorded by: <span className="text-slate-200">{m.author}</span>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-sans leading-relaxed">
                  {m.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
