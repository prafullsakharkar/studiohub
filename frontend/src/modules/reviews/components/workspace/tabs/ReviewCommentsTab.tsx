import React, { useState } from 'react';
import { ReviewSession, ReviewComment } from '@/types/reviews';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import {
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  Send,
  Eye,
  EyeOff,
  Filter,
  Tag,
  Clock,
  CornerDownRight,
  User,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface ReviewCommentsTabProps {
  review: ReviewSession;
  onAddComment: (comment: Partial<ReviewComment>) => Promise<any>;
  onResolveComment: (commentId: string) => Promise<any>;
  onReopenComment: (commentId: string) => Promise<any>;
  onSeekToFrame?: (frame: number) => void;
  isAddingComment?: boolean;
}

export const ReviewCommentsTab: React.FC<ReviewCommentsTabProps> = ({
  review,
  onAddComment,
  onResolveComment,
  onReopenComment,
  onSeekToFrame,
  isAddingComment,
}) => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved' | 'client'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentFrame, setNewCommentFrame] = useState<number>(1);
  const [isClientVisible, setIsClientVisible] = useState(true);
  const [newTag, setNewTag] = useState('Lighting');

  const comments = review.comments || [];

  const filteredComments = comments.filter((c) => {
    if (filter === 'unresolved' && c.is_resolved) return false;
    if (filter === 'resolved' && !c.is_resolved) return false;
    if (filter === 'client' && !c.is_client_visible) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.text.toLowerCase().includes(q) ||
        c.author.name.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    await onAddComment({
      text: newCommentText.trim(),
      frame_number: newCommentFrame,
      timecode: `01:00:0${Math.floor(newCommentFrame / 24)}:${(newCommentFrame % 24).toString().padStart(2, '0')}`,
      is_client_visible: isClientVisible,
      tags: [newTag],
      author: {
        id: user?.id || 'usr-001',
        name: user?.full_name || 'Alex Chen',
        avatar: user?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        role: user?.role || 'VFX Supervisor',
      },
    });

    setNewCommentText('');
  };

  return (
    <div id="review-comments-tab" className="p-6 space-y-6 max-w-5xl mx-auto custom-scrollbar overflow-y-auto">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            Review Comments & Directives ({comments.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Frame-accurate feedback, notes, and resolution status for this turnover cut.
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({comments.length})
          </button>
          <button
            onClick={() => setFilter('unresolved')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filter === 'unresolved' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Open ({comments.filter((c) => !c.is_resolved).length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filter === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Resolved ({comments.filter((c) => c.is_resolved).length})
          </button>
          <button
            onClick={() => setFilter('client')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filter === 'client' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Client Visible
          </button>
        </div>
      </div>

      {/* Post New Comment Composer */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="py-2.5 px-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Add Review Comment
          </span>
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400">Target Frame:</span>
              <input
                type="number"
                min="1"
                max={review.total_frames || 200}
                value={newCommentFrame}
                onChange={(e) => setNewCommentFrame(Number(e.target.value))}
                className="w-14 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-emerald-400 font-bold text-right"
              />
            </div>
            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={isClientVisible}
                onChange={(e) => setIsClientVisible(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
              />
              <span className="text-[11px]">Client Visible</span>
            </label>
          </div>
        </CardHeader>
        <CardBody className="p-4 space-y-3">
          <textarea
            rows={2}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="e.g. Flare falloff on edge is 0.05 too hot, reduce intensity and match plate noise..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
          />

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">Department Tag:</span>
              {['Lighting', 'Comp', 'FX', 'LookDev', 'Animation', 'Roto'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNewTag(tag)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                    newTag === tag
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePostComment}
              isLoading={isAddingComment}
              disabled={!newCommentText.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-500"
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Post Comment
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Comments List */}
      <div className="space-y-3">
        {filteredComments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No comments matching the current filter.
          </div>
        ) : (
          filteredComments.map((com) => (
            <Card
              key={com.id}
              className={`bg-slate-900 border transition-all ${
                com.is_resolved
                  ? 'border-slate-800/80 bg-slate-900/40 opacity-80'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <CardBody className="p-4 space-y-3">
                {/* Top Row: Author, Frame Badge, Timestamp, Visibility */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={com.author.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                      alt={com.author.name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        {com.author.name}
                        <span className="text-[10px] text-slate-400 font-normal font-mono">({com.author.role})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(com.created_at).toLocaleDateString()} at{' '}
                        {new Date(com.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Frame Jump Button */}
                    {com.frame_number && (
                      <button
                        onClick={() => onSeekToFrame && onSeekToFrame(com.frame_number!)}
                        className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-mono font-bold transition-colors"
                        title="Jump to frame in player"
                      >
                        Frame {com.frame_number}
                      </button>
                    )}

                    {/* Client Visible Tag */}
                    {com.is_client_visible ? (
                      <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded font-mono text-[10px] flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Client
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono text-[10px] flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        Internal
                      </span>
                    )}

                    {/* Tags */}
                    {com.tags?.map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-mono text-[10px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Comment Text */}
                <p className="text-xs text-slate-200 leading-relaxed font-sans pl-9.5">{com.text}</p>

                {/* Bottom Row: Resolution status & Action button */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs pl-9.5">
                  <div>
                    {com.is_resolved ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolved by {com.resolved_by?.name || 'Lead Supervisor'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Open Action Item
                      </span>
                    )}
                  </div>

                  <div>
                    {com.is_resolved ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onReopenComment(com.id)}
                        className="text-[11px] border-slate-700 text-slate-400 hover:text-white py-1 px-2.5"
                        leftIcon={<RotateCcw className="w-3 h-3" />}
                      >
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onResolveComment(com.id)}
                        className="text-[11px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 py-1 px-2.5"
                        leftIcon={<CheckCircle2 className="w-3 h-3" />}
                      >
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
