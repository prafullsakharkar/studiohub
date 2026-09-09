import React from 'react';
import { KnowledgeDocument, KnowledgeEntityRelationship } from '@/types/intelligence';
import { KnowledgeEntityLinks } from './KnowledgeEntityLinks';
import {
  FileText,
  Calendar,
  Eye,
  Heart,
  Edit,
  Trash2,
  CheckCircle2,
  Pin,
  Tag,
  Share2,
  BookOpen,
} from 'lucide-react';

interface KnowledgeDocViewerProps {
  document: KnowledgeDocument | null;
  onEdit: (doc: KnowledgeDocument) => void;
  onDelete: (id: string) => void;
  onAddLink: (docId: string, link: Omit<KnowledgeEntityRelationship, 'id'>) => void;
  onRemoveLink: (docId: string, linkId: string) => void;
}

export const KnowledgeDocViewer: React.FC<KnowledgeDocViewerProps> = ({
  document,
  onEdit,
  onDelete,
  onAddLink,
  onRemoveLink,
}) => {
  if (!document) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <BookOpen className="w-12 h-12 text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">Select a document to read</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Explore pipeline procedures, SOPs, department standards, and production notes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header Bar */}
      <div className="space-y-3 pb-6 border-b border-slate-800">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {document.category.replace(/_/g, ' ')}
            </span>
            {document.project_code && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {document.project_code}
              </span>
            )}
            {document.is_pinned && (
              <span className="text-[11px] text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Pin className="w-3 h-3" /> Pinned Standard
              </span>
            )}
            {document.is_verified && (
              <span className="text-[11px] text-teal-400 flex items-center gap-1 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                <CheckCircle2 className="w-3 h-3" /> Studio Verified
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-edit-kdoc"
              onClick={() => onEdit(document)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              id="btn-delete-kdoc"
              onClick={() => onDelete(document.id)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 transition-colors cursor-pointer"
              title="Delete document"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{document.title}</h1>
        <p className="text-sm text-slate-400 leading-relaxed">{document.summary}</p>

        {/* Author Card & Metadata */}
        <div className="flex items-center justify-between pt-2 flex-wrap gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            {document.author_avatar && (
              <img
                src={document.author_avatar}
                alt={document.author_name}
                className="w-8 h-8 rounded-full object-cover border border-slate-700"
              />
            )}
            <div>
              <div className="font-medium text-slate-200">{document.author_name}</div>
              <div className="text-[11px] text-slate-400">
                {document.author_role} • {document.department_name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(document.updated_at).toLocaleDateString()} ({document.version})
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              {document.views_count} views
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              {document.likes_count}
            </span>
          </div>
        </div>
      </div>

      {/* Production Entity Links */}
      <KnowledgeEntityLinks
        linkedEntities={document.linked_entities}
        onAddLink={(link) => onAddLink(document.id, link)}
        onRemoveLink={(linkId) => onRemoveLink(document.id, linkId)}
      />

      {/* Markdown Body Content */}
      <div className="prose prose-invert prose-indigo max-w-none space-y-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap bg-slate-900/30 p-6 rounded-xl border border-slate-800/80">
        {document.content_markdown}
      </div>

      {/* Tags */}
      {document.tags.length > 0 && (
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-slate-400" />
          {document.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-md bg-slate-900 text-indigo-300 border border-slate-800"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
