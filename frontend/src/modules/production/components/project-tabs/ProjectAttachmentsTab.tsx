import React, { useState } from 'react';
import {
  FileText,
  Download,
  Shield,
  FileCode,
  Plus,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { AttachmentItem } from '@/types/attachments';
import { useAttachments } from '@/modules/attachments/hooks/useAttachments';
import { useAttachmentMutations } from '@/modules/attachments/hooks/useAttachmentMutations';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectAttachmentsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectAttachmentsTab: React.FC<ProjectAttachmentsTabProps> = ({ project, onNavigateTab }) => {
  const { data: attachmentsData, isLoading } = useAttachments({ project_id: project.id });
  const attachments: AttachmentItem[] = attachmentsData ?? [];

  const { createAttachment, isCreating } = useAttachmentMutations();
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState<'VFX Breakdown' | 'Camera & Lens Report' | 'Legal & Clearance' | 'Call Sheet' | 'Color Pipeline Spec' | 'Script Notes'>('VFX Breakdown');
  const [securityTier, setSecurityTier] = useState<'Confidential (Tier 4)' | 'Internal Studio Only' | 'Vendor Shareable'>('Internal Studio Only');
  const [desc, setDesc] = useState('');

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createAttachment({
      code: `DOC-${project.code}-${Date.now().toString().slice(-4)}`,
      file_name: fileName || 'specification_v1.pdf',
      project_id: project.id,
      project_code: project.code,
      entity_type: 'project',
      entity_id: project.id,
      entity_code: project.code,
      category,
      file_type: 'PDF Document',
      file_size_kb: 4200,
      uploaded_by: user?.full_name || 'Unknown',
      uploaded_at: new Date().toISOString(),
      version: 'v1.0',
      download_url: '#download',
      security_classification: securityTier,
      description: desc || 'Production documentation file.',
    } as Partial<AttachmentItem>);

    setIsUploadModalOpen(false);
    addNotification({
      type: 'success',
      title: 'Attachment Uploaded',
      message: `Uploaded ${fileName || 'specification_v1.pdf'} into production repository.`,
    });
  };

  const handleDownload = (file: AttachmentItem) => {
    addNotification({
      type: 'info',
      title: 'Downloading Attachment',
      message: `Retrieving ${file.file_name} from secure cloud storage.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            Production Attachments, Specifications & On-Set Reports
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Store lens distortion grids, OCIO color profiles, script supervisor logs, and legal clearances
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsUploadModalOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Upload Document
        </Button>
      </div>

      {/* Attachment Documents List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-400">
            Loading attachments…
          </div>
        )}
        {attachments.map((doc) => (
          <div
            key={doc.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <FileCode className="w-5 h-5" />
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-indigo-400">{doc.code}</span>
                  <span className="px-2 py-0.2 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                    {doc.category}
                  </span>
                  <span className="px-2 py-0.2 text-[10px] font-mono bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                    {doc.version}
                  </span>
                  <span
                    className={`px-2 py-0.2 text-[10px] font-mono rounded border flex items-center gap-1 ${
                      doc.security_classification.includes('Confidential')
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    {doc.security_classification}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white truncate font-mono">{doc.file_name}</h4>
                <p className="text-xs text-slate-400 italic line-clamp-1">{doc.description}</p>
                <p className="text-[11px] text-slate-500 font-mono">
                  {(doc.file_size_kb / 1024).toFixed(2)} MB • Uploaded by {doc.uploaded_by} •{' '}
                  {new Date(doc.uploaded_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(doc)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download
              </Button>
            </div>
          </div>
        ))}
        {!isLoading && attachments.length === 0 && (
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center text-xs text-slate-500">
            No attachments uploaded for this project yet.
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Production Attachment"
        subtitle={`Add file to repository for show ${project.code}`}
      >
        <form onSubmit={handleUploadSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">File Name</label>
            <input
              type="text"
              required
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. Master_Script_Breakdown_v2.pdf"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="VFX Breakdown">VFX Breakdown</option>
                <option value="Camera & Lens Report">Camera & Lens Report</option>
                <option value="Color Pipeline Spec">Color Pipeline Spec</option>
                <option value="Call Sheet">Call Sheet</option>
                <option value="Legal & Clearance">Legal & Clearance</option>
                <option value="Script Notes">Script Notes</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Security Classification</label>
              <select
                value={securityTier}
                onChange={(e) => setSecurityTier(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Internal Studio Only">Internal Studio Only</option>
                <option value="Vendor Shareable">Vendor Shareable</option>
                <option value="Confidential (Tier 4)">Confidential (Tier 4)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Notes on calibration and usage..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsUploadModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isCreating}>
              Upload Document
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
