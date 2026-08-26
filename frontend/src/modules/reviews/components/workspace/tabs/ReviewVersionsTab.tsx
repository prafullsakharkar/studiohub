import React from 'react';
import { ReviewSession, ReviewVersion } from '@/types/reviews';
import { Card, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import {
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  SplitSquareVertical,
  ArrowRight,
  Monitor,
  User,
  Calendar,
} from 'lucide-react';

interface ReviewVersionsTabProps {
  review: ReviewSession;
  onSelectVersionForCompare?: (version: ReviewVersion) => void;
}

export const ReviewVersionsTab: React.FC<ReviewVersionsTabProps> = ({
  review,
  onSelectVersionForCompare,
}) => {
  const versions = review.versions || [];

  return (
    <div id="review-versions-tab" className="p-6 space-y-6 max-w-5xl mx-auto custom-scrollbar overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Published Version Iterations ({versions.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            History of artist turnovers and cut revisions submitted for {review.entity_code}.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {versions.map((ver, idx) => {
          const isCurrent = ver.version_number === review.version_number;

          return (
            <Card
              key={ver.id}
              className={`bg-slate-900 border transition-all ${
                isCurrent
                  ? 'border-indigo-500/50 ring-1 ring-indigo-500/20 bg-indigo-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <CardBody className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Left: Thumbnail + Version Info */}
                <div className="flex items-center space-x-4">
                  <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                    <img
                      src={ver.thumbnail_url || review.thumbnail_url}
                      alt={ver.version_number}
                      className="w-full h-full object-cover"
                    />
                    {isCurrent && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-indigo-600 text-white font-mono text-[9px] font-bold shadow">
                        CURRENT HERO
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white font-mono">{ver.version_number}</span>
                      <StatusBadge status={ver.status} />
                      {ver.is_hero && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px]">
                          Approved Hero
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        {ver.artist_name}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Monitor className="w-3.5 h-3.5 text-slate-500" />
                        {ver.resolution} ({ver.fps} fps)
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(ver.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {ver.changelog && (
                      <p className="text-xs text-slate-300 font-mono pt-1">
                        <span className="text-slate-500">Changelog:</span> {ver.changelog}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  {onSelectVersionForCompare && !isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectVersionForCompare(ver)}
                      className="text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                      leftIcon={<SplitSquareVertical className="w-3.5 h-3.5" />}
                    >
                      Compare in A/B Wipe
                    </Button>
                  )}
                  {isCurrent ? (
                    <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Active Cut
                    </div>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
