import React, { useState } from 'react';
import { ReviewSession, ReviewNote } from '@/types/reviews';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import {
  FileText,
  Pin,
  Sparkles,
  Building,
  UserCheck,
  Send,
  Plus,
  Tag,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface ReviewNotesTabProps {
  review: ReviewSession;
  onAddNote: (note: Partial<ReviewNote>) => Promise<any>;
  isAddingNote?: boolean;
}

export const ReviewNotesTab: React.FC<ReviewNotesTabProps> = ({
  review,
  onAddNote,
  isAddingNote,
}) => {
  const { user } = useAuth();
  const [category, setCategory] = useState<ReviewNote['category']>('Supervisor');
  const [noteContent, setNoteContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const notes = review.notes || [];

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    await onAddNote({
      category,
      content: noteContent.trim(),
      is_pinned: isPinned,
      author_name: user?.full_name || 'Alex Chen',
      author_avatar: user?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      author_role: user?.role || 'VFX Supervisor',
    });

    setNoteContent('');
    setIsPinned(false);
    setIsComposing(false);
  };

  const getCategoryBadge = (cat: ReviewNote['category']) => {
    switch (cat) {
      case 'Supervisor':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px] flex items-center gap-1 font-bold">
            <Sparkles className="w-3 h-3" />
            Supervisor Note
          </span>
        );
      case 'Client Feedback':
        return (
          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-[10px] flex items-center gap-1 font-bold">
            <Building className="w-3 h-3" />
            Client Feedback
          </span>
        );
      case 'Vendor Directive':
        return (
          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[10px] flex items-center gap-1 font-bold">
            <UserCheck className="w-3 h-3" />
            Vendor Directive
          </span>
        );
      case 'Technical QC':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] flex items-center gap-1 font-bold">
            Technical QC
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Internal Note
          </span>
        );
    }
  };

  return (
    <div id="review-notes-tab" className="p-6 space-y-6 max-w-5xl mx-auto custom-scrollbar overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Session Notes & Directives ({notes.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Documented client guidelines, supervisor sign-off feedback, and vendor notes.
          </p>
        </div>

        {!isComposing && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsComposing(true)}
            className="text-xs bg-indigo-600 hover:bg-indigo-500"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Session Note
          </Button>
        )}
      </div>

      {/* Note Composer Modal/Form */}
      {isComposing && (
        <Card className="bg-slate-900 border-indigo-500/40">
          <CardHeader className="py-2.5 px-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              New Session Record Note
            </span>
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 text-xs">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                />
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Pin className="w-3 h-3 text-amber-400" />
                  Pin High Priority
                </span>
              </label>
            </div>
          </CardHeader>
          <CardBody className="p-4 space-y-3">
            {/* Category Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">Note Category:</span>
              {(['Supervisor', 'Client Feedback', 'Vendor Directive', 'Internal Note', 'Technical QC'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                    category === cat
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Document comprehensive supervisor feedback, client notes from screening call, or technical turnover guidelines..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex justify-end space-x-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsComposing(false)}
                className="text-xs border-slate-700 text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveNote}
                isLoading={isAddingNote}
                disabled={!noteContent.trim()}
                className="text-xs bg-indigo-600 hover:bg-indigo-500"
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Save Note
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Notes Grid */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
            No notes logged for this review session.
          </div>
        ) : (
          notes.map((note) => (
            <Card
              key={note.id}
              className={`bg-slate-900 border transition-all ${
                note.is_pinned
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <CardBody className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={note.author_avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'}
                      alt={note.author_name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        {note.author_name}
                        <span className="text-[10px] text-slate-400 font-mono font-normal">
                          ({note.author_role})
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(note.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {note.is_pinned && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px] flex items-center gap-1 font-bold">
                        <Pin className="w-3 h-3" />
                        Pinned
                      </span>
                    )}
                    {getCategoryBadge(note.category)}
                  </div>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap pl-9.5">
                  {note.content}
                </p>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
