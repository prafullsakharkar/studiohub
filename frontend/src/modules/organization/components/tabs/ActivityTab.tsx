import React from 'react';
import { Activity, ShieldCheck, UserCheck, HardDrive, Cpu, Clock } from 'lucide-react';
import { Organization } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

interface ActivityItem {
  id: string;
  action: string;
  user: string;
  category: 'Security' | 'Pipeline' | 'Storage' | 'Personnel';
  timestamp: string;
  description: string;
}

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-01',
    action: 'OCIO Pipeline Rule Applied',
    user: 'Alex Chen (VFX Supervisor)',
    category: 'Pipeline',
    timestamp: '10 minutes ago',
    description: 'Updated default color transform standard to ACEScg 1.3 for all 2026 feature shows.',
  },
  {
    id: 'act-02',
    action: 'Facility Hub SAN Linked',
    user: 'Marcus Vance (Chief Systems Architect)',
    category: 'Storage',
    timestamp: '2 hours ago',
    description: 'Synced 100Gbps high-bandwidth dedicated dark fiber between Montreal and London offices.',
  },
  {
    id: 'act-03',
    action: 'Enterprise SSO Verified',
    user: 'Security Sentinel (Automated)',
    category: 'Security',
    timestamp: '5 hours ago',
    description: 'MPAA Level 4 annual cryptographic key rotation and SAML certificate renewal succeeded.',
  },
  {
    id: 'act-04',
    action: 'Department Lead Appointed',
    user: 'Sarah Jenkins (Head of Production)',
    category: 'Personnel',
    timestamp: '1 day ago',
    description: 'Promoted Elena Rostova to Lead Creature FX Supervisor for show NK99.',
  },
];

export const ActivityTab: React.FC<{ org: Organization }> = ({ org }) => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Studio Tenancy Audit Log & Activity Trail
          </h2>
          <p className="text-xs text-slate-400">
            Immutable security log recording multi-tenant access, pipeline changes, and facility updates.
          </p>
        </div>

        <Badge variant="outline" className="font-mono text-xs text-slate-400">
          Live Stream
        </Badge>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/90 divide-y divide-slate-800/80 overflow-hidden shadow-xs">
        {MOCK_ACTIVITIES.map((act) => (
          <div key={act.id} className="p-4 flex items-start gap-3.5 hover:bg-slate-800/30 transition-colors">
            <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-indigo-400 shrink-0 mt-0.5">
              {act.category === 'Security' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : act.category === 'Storage' ? (
                <HardDrive className="w-4 h-4 text-purple-400" />
              ) : act.category === 'Pipeline' ? (
                <Cpu className="w-4 h-4 text-indigo-400" />
              ) : (
                <UserCheck className="w-4 h-4 text-cyan-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-white">{act.action}</h4>
                  <Badge variant="outline" className="text-[9px] font-mono text-slate-400">
                    {act.category}
                  </Badge>
                </div>
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {act.timestamp}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">{act.description}</p>
              <div className="text-[10px] text-slate-500 font-mono mt-1">Initiator: {act.user}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
