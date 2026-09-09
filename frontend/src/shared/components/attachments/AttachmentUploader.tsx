import React, { useState } from 'react';
import {
  UploadCloud,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AttachmentCategory, AttachmentItem } from '@/types/attachments';
import { UniversalEntityType } from '@/types/workspace';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Modal } from '../Modal';

interface AttachmentUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: Partial<AttachmentItem>) => Promise<any>;
  entityType?: UniversalEntityType | string;
  entityId?: string;
  entityCode?: string;
  projectId?: string;
  projectCode?: string;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  isOpen,
  onClose,
  onUpload,
  entityType = 'version',
  entityId = 'ver-001',
  entityCode = 'CYBER_HERO_BODY_v004',
  projectId = 'proj-001',
  projectCode = 'NK99',
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; type: string } | null>(null);
  const [category, setCategory] = useState<AttachmentCategory>('VFX Breakdown');
  const [versionTag, setVersionTag] = useState<string>('v001');
  const [security, setSecurity] = useState<'Internal Production' | 'Confidential Tier 1' | 'Public Reference'>('Internal Production');
  const [description, setDescription] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const categories: AttachmentCategory[] = [
    'VFX Breakdown',
    'Camera & Lens Report',
    'Color Pipeline Spec',
    'Concept & LookDev',
    'Reference Photography',
    'On-Set HDR Survey',
    'Call Sheet & Schedule',
    'Quality Control Log',
    'Contract & Rights',
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(20);

    // Simulate multi-tier chunk upload
    const timer1 = setTimeout(() => setUploadProgress(65), 300);
    const timer2 = setTimeout(async () => {
      setUploadProgress(100);

      await onUpload({
        entity_type: entityType as any,
        entity_id: entityId,
        entity_code: entityCode,
        project_id: projectId,
        project_code: projectCode,
        file_name: selectedFile.name,
        file_type: selectedFile.type || 'Document File',
        file_size_kb: Math.round(selectedFile.size / 1024) || 2048,
        category: category,
        version: versionTag,
        security_classification: security,
        description: description || `Production attachment for ${entityCode}`,
        uploaded_by: 'Alex Vance (Lead TD)',
        tags: [category.toLowerCase().replace(/ /g, '-'), 'upload'],
      });

      setIsUploading(false);
      setSelectedFile(null);
      setUploadProgress(0);
      onClose();
    }, 700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Production Attachment" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drag and Drop Zone */}
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-200">
              Drag & Drop production files or{' '}
              <label className="text-blue-400 hover:text-blue-300 cursor-pointer underline">
                Browse Files
                <input type="file" onChange={handleFileSelect} className="hidden" />
              </label>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports PDF, OCIO configs, JSON manifests, EXR metadata, camera reports, ZIP archives (up to 5 GB).
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                <File className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-mono font-semibold text-slate-200 block truncate">
                  {selectedFile.name}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {Math.round((selectedFile.size / (1024 * 1024)) * 10) / 10} MB
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>Streaming chunks to studio storage...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Attachment Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-900 text-slate-200">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Version Tag</label>
            <input
              type="text"
              value={versionTag}
              onChange={(e) => setVersionTag(e.target.value)}
              placeholder="e.g. v001"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Security Classification</label>
            <select
              value={security}
              onChange={(e) => setSecurity(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="Internal Production">Internal Production (Standard NDA)</option>
              <option value="Confidential Tier 1">Confidential Tier 1 (Watermarked)</option>
              <option value="Public Reference">Public Reference (Unrestricted)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Entity Binding</label>
            <div className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 truncate">
              {entityType}: <strong className="text-slate-200">{entityCode}</strong>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Notes & Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Provide context, revision changelog, or spec summary..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!selectedFile || isUploading}
            isLoading={isUploading}
          >
            Upload Attachment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
