import React from 'react';
import { Shot } from '@/types/production';
import {
  Users,
  UserCheck,
  Plus,
  Shield,
  Clock,
  Briefcase,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export interface ShotAssignmentsTabProps {
  shot: Shot;
  onOpenAssign: () => void;
}

export const ShotAssignmentsTab: React.FC<ShotAssignmentsTabProps> = ({
  shot,
  onOpenAssign,
}) => {
  const departmentStaffing = [
    {
      department: 'Compositing',
      role: 'Lead Compositor (Primary)',
      artist: shot.assigned_artist_name || 'Elena Rostova',
      status: 'Active Assignment',
      avatar: (shot.assigned_artist_name || 'E')[0],
      isLead: true,
    },
    {
      department: 'VFX Supervision',
      role: 'Sequence Supervisor',
      artist: 'Alex Chen',
      status: 'Reviewing',
      avatar: 'A',
      isLead: false,
    },
    {
      department: 'Lighting & Lookdev',
      role: 'Senior Lighting TD',
      artist: 'Marcus Vance',
      status: 'Complete',
      avatar: 'M',
      isLead: false,
    },
    {
      department: 'FX Simulation',
      role: 'Houdini FX Artist',
      artist: 'Kai Thorne',
      status: 'In Progress',
      avatar: 'K',
      isLead: false,
    },
    {
      department: 'Matchmove & Layout',
      role: 'Camera Tracking TD',
      artist: 'David Mercer',
      status: 'Approved',
      avatar: 'D',
      isLead: false,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Department Roster & Staffing Allocations
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenAssign}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Assign / Reallocate Artist
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {departmentStaffing.map((staff, idx) => (
          <Card key={idx} className="border-slate-800 bg-slate-900 shadow-md">
            <CardBody className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
                  {staff.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white">{staff.artist}</h4>
                    {staff.isLead && (
                      <span className="text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {staff.department} • {staff.role}
                  </div>
                </div>
              </div>

              <Badge
                variant={
                  staff.status === 'Approved' || staff.status === 'Complete'
                    ? 'success'
                    : staff.status === 'Active Assignment'
                    ? 'info'
                    : 'neutral'
                }
                className="text-[10px] font-mono uppercase shrink-0"
              >
                {staff.status}
              </Badge>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};
