import React, { useState } from 'react';
import { useKnowledgeHub } from '../../hooks/useKnowledgeHub';
import { KnowledgeDocViewer } from './KnowledgeDocViewer';
import { KnowledgeDocEditorModal } from './KnowledgeDocEditorModal';
import { KnowledgeDocument } from '@/types/intelligence';
import {
  BookOpen,
  Search,
  Plus,
  Pin,
  Tag,
  Layers,
  FileCode2,
  Sliders,
  CheckCircle2,
  Filter,
} from 'lucide-react';

const CATEGORY_ITEMS: { id: string; label: string; icon: string }[] = [
  { id: 'ALL', label: 'All Knowledge', icon: '🌐' },
  { id: 'pipeline', label: 'Pipeline Standards', icon: '⚙️' },
  { id: 'sop', label: 'Department SOPs', icon: '📋' },
  { id: 'project_knowledge', label: 'Project Notes', icon: '🎬' },
  { id: 'client_guidelines', label: 'Client Guidelines', icon: '🤝' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🛠️' },
];

export const KnowledgeHubWorkspace: React.FC = () => {
  const {
    documents,
    activeDoc,
    selectedCategory,
    setSelectedCategory,
    selectedProject,
    setSelectedProject,
    searchQuery,
    setSearchQuery,
    loading,
    selectDoc,
    createDoc,
    updateDoc,
    deleteDoc,
    linkEntity,
    unlinkEntity,
  } = useKnowledgeHub();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDocument | null>(null);

  const handleOpenCreate = () => {
    setEditingDoc(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (doc: KnowledgeDocument) => {
    setEditingDoc(doc);
    setIsEditorOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Studio Knowledge Hub</span>
              <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {documents.length} Docs
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Pipeline standards, department SOPs, and show continuity notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative w-64 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="input-knowledge-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SOPs, USD, ACES, notes..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            id="btn-create-knowledge-doc"
            onClick={handleOpenCreate}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Document</span>
          </button>
        </div>
      </header>

      {/* Main Dual-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Category & Doc List Pane */}
        <div className="w-96 border-r border-slate-800/80 bg-slate-950/70 flex flex-col shrink-0 overflow-hidden">
          {/* Categories Nav */}
          <div className="p-3 border-b border-slate-800/60 flex flex-wrap gap-1 bg-slate-900/30">
            {CATEGORY_ITEMS.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-300 font-medium border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-xs">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Doc List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {documents.length > 0 ? (
              documents.map((doc) => {
                const isActive = activeDoc?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    id={`kdoc-card-${doc.id}`}
                    onClick={() => selectDoc(doc.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                      isActive
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-sm'
                        : 'bg-slate-900/40 hover:bg-slate-800/50 border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        {doc.is_pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-950 text-indigo-400 border border-slate-800">
                          {doc.category}
                        </span>
                        {doc.project_code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-emerald-400 border border-slate-800">
                            {doc.project_code}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {doc.version}
                      </span>
                    </div>

                    <h4
                      className={`text-xs font-semibold line-clamp-1 ${
                        isActive ? 'text-indigo-200' : 'text-slate-200'
                      }`}
                    >
                      {doc.title}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                      {doc.summary}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/40">
                      <span>{doc.department_name}</span>
                      <span>{doc.linked_entities.length} links</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                No documents found in this category.
              </div>
            )}
          </div>
        </div>

        {/* Right Active Viewer */}
        <main className="flex-1 bg-slate-950 overflow-hidden flex flex-col">
          <KnowledgeDocViewer
            document={activeDoc}
            onEdit={handleOpenEdit}
            onDelete={deleteDoc}
            onAddLink={linkEntity}
            onRemoveLink={unlinkEntity}
          />
        </main>
      </div>

      {/* Editor Modal */}
      <KnowledgeDocEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        document={editingDoc}
        onSave={async (data) => {
          if (editingDoc) {
            await updateDoc(editingDoc.id, data);
          } else {
            await createDoc(data);
          }
        }}
      />
    </div>
  );
};
