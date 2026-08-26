import React, { useState, useEffect } from 'react';
import { KnowledgeDocument, KnowledgeCategory } from '@/types/intelligence';
import { X, Check, FileText } from 'lucide-react';

interface KnowledgeDocEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: KnowledgeDocument | null;
  onSave: (docData: any) => Promise<void>;
}

export const KnowledgeDocEditorModal: React.FC<KnowledgeDocEditorModalProps> = ({
  isOpen,
  onClose,
  document,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory>('pipeline');
  const [departmentName, setDepartmentName] = useState('Pipeline & Tooling');
  const [projectCode, setProjectCode] = useState('ALL');
  const [tagsText, setTagsText] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [version, setVersion] = useState('v1.0.0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setSummary(document.summary);
      setCategory(document.category);
      setDepartmentName(document.department_name || 'Pipeline & Tooling');
      setProjectCode(document.project_code || 'ALL');
      setTagsText(document.tags.join(', '));
      setContentMarkdown(document.content_markdown);
      setVersion(document.version);
    } else {
      setTitle('');
      setSummary('');
      setCategory('pipeline');
      setDepartmentName('Pipeline & Tooling');
      setProjectCode('ALL');
      setTagsText('USD, SOP, Pipeline');
      setContentMarkdown('# New Knowledge Standard\n\n## Overview\nDescribe the procedural standard here...');
      setVersion('v1.0.0');
    }
  }, [document, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await onSave({
        title: title.trim(),
        slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
        summary: summary.trim(),
        category,
        department_name: departmentName,
        project_code: projectCode,
        tags,
        content_markdown: contentMarkdown,
        version,
        author_name: 'Prafull Sakharkar',
        author_role: 'Studio Supervisor',
        is_pinned: document?.is_pinned || false,
        is_verified: true,
        linked_entities: document?.linked_entities || [],
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-base">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>{document ? 'Edit Knowledge Document' : 'Create Knowledge Document'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Title & Version */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3 space-y-1">
              <label className="font-semibold text-slate-300">Document Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. OpenUSD Sublayering and Payload Best Practices"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Category, Department, Project */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              >
                <option value="pipeline">Pipeline Doc</option>
                <option value="sop">Department SOP</option>
                <option value="production_notes">Production Notes</option>
                <option value="project_knowledge">Project Knowledge</option>
                <option value="client_guidelines">Client Guidelines</option>
                <option value="troubleshooting">Troubleshooting</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Department</label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Project Scope</label>
              <select
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono"
              >
                <option value="ALL">ALL (Global Studio)</option>
                <option value="NK99">NK99 (Nebula Knights)</option>
                <option value="DUNE">DUNE (Dune Sisterhood)</option>
                <option value="CP88">CP88 (Cyberpunk 2088)</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Executive Summary</label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="High-level description of what this documentation covers..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 resize-none focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Tags (comma separated)</label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="USD, Nuke, Karma, Deep EXR, Cryptomatte"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
            />
          </div>

          {/* Markdown Content */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Content (Markdown Supported)</label>
            <textarea
              rows={10}
              required
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-kdoc-submit"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Knowledge Document'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
