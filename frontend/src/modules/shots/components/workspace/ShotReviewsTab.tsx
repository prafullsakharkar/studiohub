import React, { useState } from 'react';
import { Shot } from '@/types/production';
import {
  Film,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  MessageSquare,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link } from 'react-router-dom';

export interface ShotReviewsTabProps {
  shot: Shot;
}

export const ShotReviewsTab: React.FC<ShotReviewsTabProps> = ({ shot }) => {
  const { addNotification } = useNotificationStore();

  const [reviews, setReviews] = useState([
    {
      id: 'rev-1',
      title: 'Dailies Screening — SQ01 Sequence Context',
      reviewer: 'Alex Chen (VFX Supervisor)',
      date: 'Yesterday at 16:30',
      verdict: 'Approved' as const,
      version: shot.current_version || 'v003',
      notes: 'Final comp approved for client delivery. Great balance on atmospheric smoke and laser highlights.',
      annotationsCount: 4,
    },
    {
      id: 'rev-2',
      title: 'Internal Department QC & Grain Match',
      reviewer: 'Elena Rostova (Lead Comp)',
      date: '3 days ago',
      verdict: 'Changes Requested' as const,
      version: 'v002',
      notes: 'Needs color correction on edge fringe in top-left matte. Match 35mm grain plate on frames 1040-1080.',
      annotationsCount: 7,
    },
  ]);

  const handleStartReview = () => {
    addNotification({
      type: 'info',
      title: 'Review Session Queued',
      message: `Shot ${shot.code} added to today's afternoon dailies playlist.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Screenings & Review History ({reviews.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/reviews">
            <Button variant="outline" size="sm" className="text-xs">
              Open Review Room
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartReview}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Queue in Dailies
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((rev) => (
          <Card key={rev.id} className="border-slate-800 bg-slate-900 shadow-md">
            <CardBody className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{rev.title}</h4>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Reviewed by {rev.reviewer} • {rev.date}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {rev.version}
                  </span>
                  <Badge
                    variant={rev.verdict === 'Approved' ? 'success' : 'warning'}
                    className="text-[10px] uppercase font-mono"
                  >
                    {rev.verdict}
                  </Badge>
                </div>
              </div>

              <p className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                {rev.notes}
              </p>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>{rev.annotationsCount} on-screen frame annotations</span>
                </div>
                <Link
                  to="/reviews"
                  className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  Inspect in CinePlay <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};
