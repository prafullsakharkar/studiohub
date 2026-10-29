import React from 'react';
import { PlaySquare, CheckCircle2, AlertCircle, ArrowUpRight, Users, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardReviewsData } from '../types';

export interface ReviewVersionHealthProps {
  reviewsData: DashboardReviewsData;
  projectId: string;
}

export const ReviewVersionHealth: React.FC<ReviewVersionHealthProps> = ({ reviewsData, projectId }) => {
  return (
    <div id="dashboard-review-health-widget" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
            <PlaySquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Screening Room &amp; Reviews</h2>
            <p className="text-[11px] text-slate-400">Supervisor &amp; client sign-off velocity</p>
          </div>
        </div>

        <Link
          to={`/reviews?project=${projectId}`}
          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
        >
          Screening Room
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Review Queue Telemetry */}
      <div className="grid grid-cols-4 gap-2 text-center font-mono">
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-cyan-400 uppercase">Pending</div>
          <div className="text-base font-bold text-cyan-300 mt-0.5">{reviewsData.pending}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-emerald-400 uppercase">Approved</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">{reviewsData.approved}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-amber-400 uppercase">Changes</div>
          <div className="text-base font-bold text-amber-400 mt-0.5">{reviewsData.changes_requested}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
          <div className="text-[10px] text-rose-400 uppercase">Rejected</div>
          <div className="text-base font-bold text-rose-400 mt-0.5">{reviewsData.rejected}</div>
        </div>
      </div>

      {/* Recent Review Sessions */}
      <div className="space-y-2 pt-1">
        <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
          Scheduled Dailies &amp; Review Sessions
        </h3>

        {reviewsData.recent_reviews.length === 0 ? (
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            No active review sessions scheduled.
          </div>
        ) : (
          <div className="space-y-2">
            {reviewsData.recent_reviews.slice(0, 3).map((review) => (
              <div
                key={review.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-cyan-500/40 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-slate-200 truncate">{review.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                    <span className="text-cyan-400">{review.type}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      {review.reviewers_count} reviewers
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                      review.status === 'Completed' || review.status === 'Approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : review.status === 'In Progress'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {review.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
