import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Tag,
  Clock,
  User,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { useProjectNotes, useCreateProjectNote } from '../../hooks/useProjectScopedData';
import { Button } from '@/shared/components/Button';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Modal } from '@/shared/components/Modal';
import { SearchInput } from '@/shared/components/SearchInput';
import { PriorityLevel } from '@/types/common';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

// REST-only shim: mock engine removed; backend is the source of truth.
import type { Project } from '@/types/production';

interface ProjectNotesTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectNotesTab: React.FC<ProjectNotesTabProps> = ({ project, onNavigateTab }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState<any>('Supervisor Note');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('Medium');
  const [newTags, setNewTags] = useState('');

  const addNotification = useNotificationStore((s) => s.addNotification);

  const { data: notesData, isLoading, refetch } = useProjectNotes(project.id, {
    search: search || undefined,
  });

  const createNoteMutation = useCreateProjectNote(project.id);

  const notes = notesData?.results || [];
  const filteredNotes = notes.filter((n) => {
    if (categoryFilter !== 'ALL' && n.category !== categoryFilter) return false;
    return true;
  });

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) return;

    try {
      await createNoteMutation.mutateAsync({
        subject: newSubject,
        body: newBody,
        category: newCategory,
        priority: newPriority,
        tags: newTags ? newTags.split(',').map((t) => t.trim()) : [],
        author_id: 'usr-001',
        author_name: 'Alex Chen',
        author_role: 'VFX Supervisor',
      });

      addNotification({
        type: 'success',
        title: 'Note Published',
        message: `Note '${newSubject}' added to project ${project.code}`,
      });

      setIsCreateOpen(false);
      setNewSubject('');
      setNewBody('');
      setNewTags('');
      refetch();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to create note',
        message: err.message || 'Error occurred',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
          <SearchInput
            placeholder="Search notes, tags, feedback..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Supervisor Note">Supervisor Note</option>
            <option value="Director Feedback">Director Feedback</option>
            <option value="Client Note">Client Note</option>
            <option value="Pipeline Notice">Pipeline Notice</option>
            <option value="Turnover Requirement">Turnover Requirement</option>
            <option value="General">General</option>
          </select>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Note
          </Button>
        </div>
      </div>

      {/* Notes Stream */}
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredNotes.length === 0 ? (
        <EmptyState
          title="No Project Notes Found"
          description={`No notes or director feedback match the selected criteria for ${project.name}.`}
          actionLabel="Add New Note"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="space-y-3.5">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {note.category}
                    </span>
                    {note.entity_code && (
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {note.entity_code}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                        note.priority === 'Critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : note.priority === 'High'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {note.priority}
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                        note.status === 'Addressed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      {note.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">{note.subject}</h3>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(note.created_at ?? Date.now()).toLocaleDateString()}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
                {note.body}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                    {note.author_name.charAt(0)}
                  </div>
                  <span className="text-slate-300 font-medium">{note.author_name}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 text-[11px]">{note.author_role}</span>
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800/70 text-slate-400 rounded border border-slate-700/50 flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5" /> #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Note Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Production Note"
        subtitle={`Publish new supervisor or client note for ${project.name} (${project.code})`}
      >
        <form onSubmit={handleCreateNote} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Subject</label>
            <input
              required
              type="text"
              placeholder="e.g. Rain Particle Density on High-Angle Downward Shots"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                <option value="Supervisor Note">Supervisor Note</option>
                <option value="Director Feedback">Director Feedback</option>
                <option value="Client Note">Client Note</option>
                <option value="Pipeline Notice">Pipeline Notice</option>
                <option value="Turnover Requirement">Turnover Requirement</option>
                <option value="General">General</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Note Content / Action Items</label>
            <textarea
              required
              rows={4}
              placeholder="Detail the artistic feedback, technical observations, or revision directives..."
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Tags (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. RainSim, Bloom, HeroShot"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={createNoteMutation.isPending}>
              {createNoteMutation.isPending ? 'Publishing...' : 'Publish Note'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
