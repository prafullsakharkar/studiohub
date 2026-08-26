import React from 'react';
import { ReviewSession } from '@/types/reviews';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { StatusBadge } from '@/shared/components/StatusBadge';
import {
  Film,
  Building,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Monitor,
  Video,
  FileText,
  Calendar,
  Eye,
} from 'lucide-react';

interface ReviewOverviewTabProps {
  review: ReviewSession;
  onNavigateTab: (tabId: string) => void;
}

export const ReviewOverviewTab: React.FC<ReviewOverviewTabProps> = ({ review, onNavigateTab }) => {
  const totalComments = review.comments?.length || 0;
  const resolvedComments = review.comments?.filter((c) => c.is_resolved).length || 0;
  const openComments = totalComments - resolvedComments;
  const totalReviewers = review.reviewers?.length || 0;
  const approvedReviewers = review.reviewers?.filter((r) => r.verdict === 'Approved').length || 0;

  return (
    <div id="review-overview-tab" className="p-6 space-y-6 max-w-6xl mx-auto custom-scrollbar overflow-y-auto">
      {/* Top Banner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Entity & Version</div>
            <div className="text-sm font-bold text-white font-mono">
              {review.entity_code} <span className="text-emerald-400 font-semibold">{review.version_number}</span>
            </div>
            <div className="text-[10px] text-slate-500">{review.project_name}</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3.5">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Specs & Resolution</div>
            <div className="text-sm font-bold text-white font-mono">{review.resolution}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              {review.fps} FPS • {review.total_frames} Frames
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Sign-Off Progress</div>
            <div className="text-sm font-bold text-white font-mono">
              {approvedReviewers} / {totalReviewers} Sign-Offs
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {openComments > 0 ? `${openComments} Open Directives` : 'All Comments Resolved'}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase text-slate-400">Supervisor Verdict</div>
            <div className="text-sm font-bold text-white font-mono">{review.supervisor_verdict || 'Pending'}</div>
            <div className="text-[10px] text-slate-500">{review.lead_reviewer_name}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Description & Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scope, Context & Notes */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="py-3 px-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Review Scope & Objectives
              </h3>
              <span className="text-xs font-mono text-slate-400">{review.department}</span>
            </CardHeader>
            <CardBody className="p-4 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                {review.description ||
                  `Review cut for ${review.entity_code} (${review.version_number}). Evaluates latest VFX turnover including compositing passes, CG lighting integration, color pipeline conformance, and client review targets.`}
              </p>

              {review.supervisor_notes && (
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Lead Supervisor Notes
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">
                    "{review.supervisor_notes}"
                  </p>
                </div>
              )}

              {/* Quick Actions to other tabs */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => onNavigateTab('media')}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5" />
                  Open Media Screening Player
                </button>
                <button
                  onClick={() => onNavigateTab('versions')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Compare Published Versions ({review.versions?.length || 1})
                </button>
                <button
                  onClick={() => onNavigateTab('comments')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Frame Comments ({totalComments})
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Technical Specifications */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="py-3 px-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-cyan-400" />
                Technical Pipeline Specifications
              </h3>
            </CardHeader>
            <CardBody className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Color Space</span>
                  <div className="text-slate-200 font-semibold">{review.color_space || 'ACEScg (AP1)'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Frame Range</span>
                  <div className="text-slate-200 font-semibold">{review.frame_range || '1001 - 1144'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Resolution</span>
                  <div className="text-slate-200 font-semibold">{review.resolution || '4096x2160 (4K DCI)'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Frame Rate</span>
                  <div className="text-slate-200 font-semibold">{review.fps} FPS</div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">DCC Pipeline</span>
                  <div className="text-slate-200 font-semibold">{review.dcc_software || 'Nuke / Maya / Houdini'}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 uppercase text-[10px]">Created At</span>
                  <div className="text-slate-200 font-semibold">
                    {new Date(review.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Stakeholders (Reviewers, Client, Vendor) */}
        <div className="space-y-6">
          {/* Reviewers Card */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="py-3 px-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Reviewers & Sign-Off
              </h3>
              <button
                onClick={() => onNavigateTab('participants')}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Manage
              </button>
            </CardHeader>
            <CardBody className="p-3 space-y-2">
              {review.reviewers && review.reviewers.length > 0 ? (
                review.reviewers.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <img
                        src={rev.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                        alt={rev.name}
                        className="w-7 h-7 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {rev.name}
                          {rev.is_required && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                              Required
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{rev.role}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        rev.verdict === 'Approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : rev.verdict === 'Changes Requested'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : rev.verdict === 'Rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rev.verdict}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-xs text-slate-500 text-center">No reviewers assigned yet.</div>
              )}
            </CardBody>
          </Card>

          {/* Client & Vendor Organization Card */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="py-3 px-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-cyan-400" />
                Authorized Client & Vendor
              </h3>
            </CardHeader>
            <CardBody className="p-4 space-y-3.5">
              {review.client ? (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Client Account</span>
                    <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {review.client.access_level || 'Full Review'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">{review.client.name}</div>
                  <div className="text-[11px] text-slate-400">Rep: {review.client.representative_name}</div>
                  {review.client.contact_email && (
                    <div className="text-[10px] text-slate-500 font-mono">{review.client.contact_email}</div>
                  )}
                </div>
              ) : (
                <div className="p-3 text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
                  Internal review only (no external client linked).
                </div>
              )}

              {review.vendor && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Vendor Partner</span>
                  <div className="text-xs font-bold text-white">{review.vendor.name}</div>
                  <div className="text-[11px] text-slate-400">Lead: {review.vendor.vendor_lead_name}</div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
