import React from 'react';
import { ReviewSession } from '@/types/reviews';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import {
  Film,
  Play,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Share2,
  ArrowLeft,
  Eye,
  UserCheck,
  Building,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface ReviewHeaderProps {
  review: ReviewSession;
  onBack?: () => void;
  onSubmit: () => void;
  onStartReview: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
  onCloseReview: () => void;
  onShare: () => void;
  isSubmitting?: boolean;
  isClientView?: boolean;
  onToggleClientView?: () => void;
}

export const ReviewHeader: React.FC<ReviewHeaderProps> = ({
  review,
  onBack,
  onSubmit,
  onStartReview,
  onApprove,
  onRequestChanges,
  onReject,
  onCloseReview,
  onShare,
  isSubmitting,
  isClientView,
  onToggleClientView,
}) => {
  const { user } = useAuth();
  const isSupervisorOrAdmin =
    user?.role === 'Platform Admin' ||
    user?.role === 'Organization Admin' ||
    user?.role === 'VFX Supervisor' ||
    user?.role === 'Lead Artist';

  const isClientRole = user?.role === 'Client Reviewer' || isClientView;

  return (
    <div id="review-header-container" className="bg-slate-900 border-b border-slate-800 px-4 py-3">
      {/* Client Simulation Banner */}
      {isClientView && (
        <div className="mb-2.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="font-medium">Client Review Mode Active:</span>
            <span className="text-slate-300">
              Viewing as {review.client?.name || 'Authorized Client'} ({review.client?.representative_name || 'Client Reviewer'})
            </span>
          </div>
          <button
            onClick={onToggleClientView}
            className="text-[11px] underline hover:text-white font-mono"
          >
            Exit Client View
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Back button + Entity Info */}
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Return to Review List"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[11px] font-bold border border-indigo-500/20">
                {review.project_code}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px] font-bold border border-slate-700">
                {review.entity_type.toUpperCase()}: {review.entity_code}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-bold border border-emerald-500/20">
                {review.version_number}
              </span>
              <StatusBadge status={review.status} />
            </div>

            <div className="flex items-center space-x-2 mt-1">
              <h2 className="text-base font-bold text-white tracking-tight">{review.title}</h2>
              <span className="text-xs font-mono text-slate-500">•</span>
              <span className="text-xs font-mono text-slate-400">{review.code}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action Review Operations */}
        <div className="flex flex-wrap items-center space-x-2">
          {/* Client View Simulator Toggle for Admins/Supervisors */}
          {isSupervisorOrAdmin && !isClientView && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleClientView}
              className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              leftIcon={<Eye className="w-3.5 h-3.5" />}
            >
              Simulate Client View
            </Button>
          )}

          {/* Share Link */}
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
            leftIcon={<Share2 className="w-3.5 h-3.5" />}
          >
            Share
          </Button>

          {/* Review Actions for Draft / Submitted states */}
          {review.status === 'Draft' && (
            <Button
              variant="primary"
              size="sm"
              onClick={onSubmit}
              isLoading={isSubmitting}
              className="text-xs bg-indigo-600 hover:bg-indigo-500"
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit to Queue
            </Button>
          )}

          {(review.status === 'Draft' || review.status === 'Submitted') && isSupervisorOrAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={onStartReview}
              isLoading={isSubmitting}
              className="text-xs bg-cyan-600 hover:bg-cyan-500"
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Start Review Session
            </Button>
          )}

          {/* Decision Verdict Actions for In Review / Pending States */}
          {(review.status === 'In Review' || review.status === 'Submitted' || review.status === 'Changes Requested') && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onRequestChanges}
                isLoading={isSubmitting}
                className="text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
              >
                Request Changes
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onReject}
                isLoading={isSubmitting}
                className="text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
              >
                Reject / Retake
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={onApprove}
                isLoading={isSubmitting}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                {isClientRole ? 'Client Sign-Off' : 'Approve Version'}
              </Button>
            </>
          )}

          {review.status !== 'Closed' && isSupervisorOrAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCloseReview}
              isLoading={isSubmitting}
              className="text-xs border-slate-700 text-slate-400 hover:text-white"
              leftIcon={<Lock className="w-3.5 h-3.5" />}
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
