import React from 'react';
import { ReviewSession, ReviewActivity } from '@/types/reviews';
import { Card, CardBody } from '@/shared/components/Card';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MessageSquare,
  Play,
  Send,
  Sparkles,
  FileText,
  Clock,
  Layers,
  Share2,
} from 'lucide-react';

interface ReviewActivityTabProps {
  review: ReviewSession;
}

export const ReviewActivityTab: React.FC<ReviewActivityTabProps> = ({ review }) => {
  const activities = review.activity || [];

  const getActivityIcon = (type: ReviewActivity['type']) => {
    switch (type) {
      case 'approve':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'reject':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'request_changes':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-cyan-400" />;
      case 'resolve_comment':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'start_review':
        return <Play className="w-4 h-4 text-indigo-400" />;
      case 'submit':
        return <Send className="w-4 h-4 text-blue-400" />;
      case 'note_added':
        return <FileText className="w-4 h-4 text-purple-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div id="review-activity-tab" className="p-6 space-y-6 max-w-4xl mx-auto custom-scrollbar overflow-y-auto">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          Review Session Activity & Audit Trail ({activities.length})
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable chronological log of all sign-offs, feedback events, and status transitions.
        </p>
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No activity logged yet for this review session.
          </div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="relative flex items-start space-x-3.5 group">
              {/* Timeline Pin Icon */}
              <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow">
                {getActivityIcon(act.type)}
              </div>

              {/* Card Body */}
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5 hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img
                      src={act.actor.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                      alt={act.actor.name}
                      className="w-5 h-5 rounded-full object-cover border border-slate-700"
                    />
                    <span className="text-xs font-bold text-white">{act.actor.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({act.actor.role || 'Member'})</span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(act.timestamp).toLocaleDateString()} at{' '}
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans">{act.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
