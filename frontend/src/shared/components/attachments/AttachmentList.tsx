import type React from 'react';
import { useState, useMemo } from 'react';
import {
  FileText,
  Image,
  Film,
  FileCode,
  Paperclip,
  Trash2,
  Plus,
  Search,
  Download,
  Eye,
  Filter,
  Shield,
  Clock,
  User,
  HardDrive,
  File,
} from 'lucide-react';
import { type AttachmentItem, AttachmentCategory } from '@/types/production';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { SearchInput } from '../SearchInput';
import { EmptyState } from '../EmptyState';
import { AttachmentUploader } from './AttachmentUploader';
import { AttachmentDownload } from './AttachmentDownload';

export interface AttachmentListProps {
  attachments: AttachmentItem[];
  isLoading?: boolean;
  onUpload?: (data: Partial<AttachmentItem>) => Promise<any>;
  onDelete?: (id: string) => Promise<any>;
  entityType?: string;
  entityId?: string;
  entityCode?: string;
  projectId?: string;
  projectCode?: string;
  title?: string;
  className?: string;
}

function getFileIcon(mimeType?: string, fileName?: string) {
  const type = (mimeType || fileName || '').toLowerCase();
  if (type.includes('image') || type.endsWith('.jpg') || type.endsWith('.png') || type.endsWith('.webp')) {
    return <Image className="w-4 h-4 text-emerald-400" />;
  }
  if (type.includes('video') || type.endsWith('.mov') || type.endsWith('.mp4') || type.endsWith('.mxf')) {
    return <Film className="w-4 h-4 text-indigo-400" />;
  }
  if (type.includes('json') || type.includes('code') || type.endsWith('.py') || type.endsWith('.nk')) {
    return <FileCode className="w-4 h-4 text-cyan-400" />;
  }
  if (type.includes('pdf') || type.includes('document') || type.endsWith('.pdf') || type.endsWith('.doc')) {
    return <FileText className="w-4 h-4 text-amber-400" />;
  }
  return <File className="w-4 h-4 text-slate-400" />;
}

function formatFileSize(kb?: number, bytes?: number): string {
  if (bytes) {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }
  if (kb) {
    if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${Math.round(kb)} KB`;
  }
  return 'N/A';
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments = [],
  isLoading = false,
  onUpload,
  onDelete,
  entityType = 'version',
  entityId = 'ver-001',
  entityCode = '',
  projectId = 'proj-001',
  projectCode = 'NK99',
  title = 'Attachments & Documents',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

  // Filter attachments
  const filteredAttachments = useMemo(() => {
    return attachments.filter((att) => {
      const fileName = att.file_name || att.name || '';
      const matchesSearch =
        !searchTerm ||
        fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (att.category && att.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'ALL' || att.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [attachments, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    attachments.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [attachments]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {attachments.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Production reference files, specs, breakdowns and scripts
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsUploaderOpen(true)}
          className="shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Upload Attachment
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search attachments by name or category..."
          className="max-w-xs"
        />

        {categories.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All ({attachments.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List / Table */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500 font-mono text-xs">
          Loading production attachments...
        </div>
      ) : filteredAttachments.length === 0 ? (
        <EmptyState
          icon={<Paperclip className="w-6 h-6" />}
          title="No Attachments Found"
          description={
            searchTerm
              ? 'No attachments matched your search filter.'
              : 'No reference files or documents uploaded for this item yet.'
          }
          action={
            onUpload ? (
              <Button size="sm" variant="outline" onClick={() => setIsUploaderOpen(true)}>
                Upload First File
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filteredAttachments.map((item) => {
            const fileName = item.file_name || item.name || 'Untitled File';
            const fileSizeStr = formatFileSize(item.file_size_kb, item.size_bytes);
            const uploader = item.uploaded_by || item.uploader_name || 'System';
            const dateStr = item.uploaded_at || item.created_at || 'Recently';

            return (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                    {getFileIcon(item.mime_type || item.file_type, fileName)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                        {fileName}
                      </span>
                      {item.category && (
                        <Badge variant="cyan" size="xs">
                          {item.category}
                        </Badge>
                      )}
                      {item.security_classification && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {item.security_classification}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-slate-500" />
                        {fileSizeStr}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {uploader}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(dateStr).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <AttachmentDownload attachment={item} variant="compact" />

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                      title="Delete attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {onUpload && (
        <AttachmentUploader
          isOpen={isUploaderOpen}
          onClose={() => setIsUploaderOpen(false)}
          onUpload={onUpload}
          entityType={entityType}
          entityId={entityId}
          entityCode={entityCode}
          projectId={projectId}
          projectCode={projectCode}
        />
      )}
    </div>
  );
};
