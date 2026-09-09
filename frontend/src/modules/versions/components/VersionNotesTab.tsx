import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  User,
  Send,
  Sparkles,
  Paperclip,
  Tag,
  Clock,
} from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface VersionNotesTabProps {
  version: ProductionVersion;
}

export const VersionNotesTab: React.FC<VersionNotesTabProps> = ({ version }) => {
  const { addNotification } = useNotificationStore();
  const [noteContent, setNoteContent] = useState('');
  const [authorRole, setAuthorRole] = useState('Lead TD');

  const [notes, setNotes] = useState([
    {
      id: 'note-1',
      author_name: 'Elena Rostova',
      author_role: 'VFX Supervisor',
      author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100',
      created_at: '2026-08-23T11:20:00Z',
      content: 'Please make sure the subsurface scattering depth map is normalized before the final 4K beauty comp bake.',
      department: 'Compositing',
    },
    {
      id: 'note-2',
      author_name: 'Marcus Chen',
      author_role: 'Senior Modeler',
      author_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      created_at: '2026-08-22T16:45:00Z',
      content: 'Updated high-poly cyber armature topology. Micro-bevels match the live-action practical prop reference perfectly.',
      department: 'Modeling',
    },
  ]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    const newNote = {
      id: `note-${Date.now()}`,
      author_name: 'Alex Vance',
      author_role: authorRole,
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      created_at: new Date().toISOString(),
      content: noteContent,
      department: version.department || 'Production',
    };

    setNotes([newNote, ...notes]);
    setNoteContent('');
    addNotification({
      type: 'success',
      title: 'Note Added',
      message: `Note added to version ${version.version_number}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* New Note Composer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold text-slate-200 uppercase flex items-center">
            <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            Add Production Note / Directive
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            Target: {version.version_number}
          </span>
        </div>

        <form onSubmit={handleAddNote} className="space-y-3">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={3}
            placeholder="Type notes, director feedback, QC instructions, or pipeline comments..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-slate-400">Posting as:</span>
              <select
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
              >
                <option value="Lead TD">Alex Vance (Lead TD)</option>
                <option value="VFX Supervisor">VFX Supervisor</option>
                <option value="Director">Director</option>
                <option value="Production Manager">Production Manager</option>
              </select>
            </div>

            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!noteContent.trim()}
              leftIcon={<Send className="w-3.5 h-3.5" />}
              className="font-mono text-xs"
            >
              Post Note
            </Button>
          </div>
        </form>
      </div>

      {/* Notes Stream */}
      <div className="space-y-3">
        {notes.map((n) => (
          <div
            key={n.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2.5">
                <img
                  src={n.author_avatar}
                  alt={n.author_name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <span className="text-xs font-mono font-bold text-slate-200">{n.author_name}</span>
                  <span className="text-[11px] font-mono text-slate-400 ml-1.5">({n.author_role})</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                  {n.department}
                </Badge>
                <span>{new Date(n.created_at).toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-mono leading-relaxed pl-9">
              {n.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
