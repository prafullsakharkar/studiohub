import React, { useState } from 'react';
import { ReviewSession, ReviewVersionRef, ReviewParticipant } from '@/types/reviews';
import { ReviewHeader } from './ReviewHeader';
import { ReviewOverviewTab } from './tabs/ReviewOverviewTab';
import { ReviewMediaTab } from './tabs/ReviewMediaTab';
import { ReviewVersionsTab } from './tabs/ReviewVersionsTab';
import { ReviewCommentsTab } from './tabs/ReviewCommentsTab';
import { ReviewNotesTab } from './tabs/ReviewNotesTab';
import { ReviewParticipantsTab } from './tabs/ReviewParticipantsTab';
import { ReviewActivityTab } from './tabs/ReviewActivityTab';
import { ReviewVerdictModal } from '../modals/ReviewVerdictModal';
import { ReviewShareModal } from '../modals/ReviewShareModal';
import { useReviewMutations } from '../../hooks/useReviewMutations';
import {
  Film,
  Video,
  Layers,
  MessageSquare,
  FileText,
  UserCheck,
  Activity,
  Sparkles,
} from 'lucide-react';

interface ReviewWorkspaceProps {
  review: ReviewSession;
  onBack?: () => void;
}

export const ReviewWorkspace: React.FC<ReviewWorkspaceProps> = ({ review, onBack }) => {
  const [activeTab, setActiveTab] = useState<string>('media');
  const [isClientView, setIsClientView] = useState<boolean>(false);

  // Modals state
  const [isVerdictModalOpen, setIsVerdictModalOpen] = useState<boolean>(false);
  const [verdictType, setVerdictType] = useState<'Approved' | 'Changes Requested' | 'Rejected'>('Approved');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const {
    submitReview,
    startReview,
    approveReview,
    rejectReview,
    requestChanges,
    closeReview,
    addComment,
    resolveComment,
    reopenComment,
    addNote,
    addAnnotation,
    isSubmitting,
    isStarting,
    isApproving,
    isRejecting,
    isRequestingChanges,
    isClosing,
    isAddingComment,
    isAddingNote,
    isAddingAnnotation,
  } = useReviewMutations();

  const isActionLoading =
    isSubmitting ||
    isStarting ||
    isApproving ||
    isRejecting ||
    isRequestingChanges ||
    isClosing;

  // Open Verdict Modal for approvals/changes
  const handleOpenVerdict = (type: 'Approved' | 'Changes Requested' | 'Rejected') => {
    setVerdictType(type);
    setIsVerdictModalOpen(true);
  };

  const handleConfirmVerdict = async (notes: string, actorName: string) => {
    if (verdictType === 'Approved') {
      await approveReview({ reviewId: review.id, notes, actorName });
    } else if (verdictType === 'Changes Requested') {
      await requestChanges({ reviewId: review.id, notes, actorName });
    } else if (verdictType === 'Rejected') {
      await rejectReview({ reviewId: review.id, notes, actorName });
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Film },
    { id: 'media', label: 'Media Viewer', icon: Video },
    {
      id: 'versions',
      label: 'Versions',
      icon: Layers,
      count: review.versions?.length || 1,
    },
    {
      id: 'comments',
      label: 'Comments',
      icon: MessageSquare,
      count: review.comments?.length || 0,
      highlight: (review.comments?.filter((c) => !c.is_resolved).length || 0) > 0,
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: FileText,
      count: review.notes?.length || 0,
    },
    {
      id: 'participants',
      label: 'Participants',
      icon: UserCheck,
      count: review.reviewers?.length || 0,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: Activity,
      count: review.activity?.length || 0,
    },
  ];

  return (
    <div id="review-workspace" className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* 1. Header Bar */}
      <ReviewHeader
        review={review}
        onBack={onBack}
        onSubmit={() => submitReview(review.id)}
        onStartReview={() => startReview(review.id)}
        onApprove={() => handleOpenVerdict('Approved')}
        onRequestChanges={() => handleOpenVerdict('Changes Requested')}
        onReject={() => handleOpenVerdict('Rejected')}
        onCloseReview={() => closeReview(review.id)}
        onShare={() => setIsShareModalOpen(true)}
        isSubmitting={isActionLoading}
        isClientView={isClientView}
        onToggleClientView={() => setIsClientView(!isClientView)}
      />

      {/* 2. Workspace Navigation Tabs */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex space-x-1 overflow-x-auto custom-scrollbar py-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center space-x-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      tab.highlight
                        ? 'bg-amber-500/20 text-amber-400 font-bold'
                        : isActive
                        ? 'bg-slate-700 text-slate-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Active Tab Viewport Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {activeTab === 'overview' && (
          <ReviewOverviewTab review={review} onNavigateTab={(tabId) => setActiveTab(tabId)} />
        )}

        {activeTab === 'media' && (
          <ReviewMediaTab
            review={review}
            onAddAnnotation={(ann) => addAnnotation({ reviewId: review.id, annotation: ann })}
            isAddingAnnotation={isAddingAnnotation}
          />
        )}

        {activeTab === 'versions' && (
          <ReviewVersionsTab
            review={review}
            onSelectVersionForCompare={() => {
              setActiveTab('media');
            }}
          />
        )}

        {activeTab === 'comments' && (
          <ReviewCommentsTab
            review={review}
            onAddComment={(com) => addComment({ reviewId: review.id, comment: com })}
            onResolveComment={(commentId) => resolveComment({ reviewId: review.id, commentId })}
            onReopenComment={(commentId) => reopenComment({ reviewId: review.id, commentId })}
            onSeekToFrame={() => {
              setActiveTab('media');
            }}
            isAddingComment={isAddingComment}
          />
        )}

        {activeTab === 'notes' && (
          <ReviewNotesTab
            review={review}
            onAddNote={(note) => addNote({ reviewId: review.id, note })}
            isAddingNote={isAddingNote}
          />
        )}

        {activeTab === 'participants' && (
          <ReviewParticipantsTab
            review={review}
            onUpdateVerdict={async (participantId, verdict, notes) => {
              if (verdict === 'Approved') {
                await approveReview({ reviewId: review.id, notes, actorName: 'Alex Chen' });
              } else if (verdict === 'Changes Requested') {
                await requestChanges({ reviewId: review.id, notes, actorName: 'Alex Chen' });
              } else if (verdict === 'Rejected') {
                await rejectReview({ reviewId: review.id, notes, actorName: 'Alex Chen' });
              }
            }}
          />
        )}

        {activeTab === 'activity' && <ReviewActivityTab review={review} />}
      </div>

      {/* 4. Verdict Sign-Off Modal */}
      <ReviewVerdictModal
        isOpen={isVerdictModalOpen}
        onClose={() => setIsVerdictModalOpen(false)}
        review={review}
        verdictType={verdictType}
        onConfirm={handleConfirmVerdict}
        isLoading={isActionLoading}
      />

      {/* 5. Share Modal */}
      <ReviewShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        review={review}
      />
    </div>
  );
};
