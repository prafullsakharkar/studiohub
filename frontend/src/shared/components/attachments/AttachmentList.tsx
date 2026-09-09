import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileCode,
  Paperclip,
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  Eye,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Share2,
  Calendar,
  Layers,
} from 'lucide-react';
import { AttachmentItem, AttachmentCategory } from '@/types/attachments';
import { AttachmentPreview } from './AttachmentPreview';
import { AttachmentUploader } from './AttachmentUploader';
import { AttachmentDownload } from './AttachmentDownload';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { EmptyState } from '../EmptyState';
import { UniversalEntityType } from '@/types/workspace';

interface AttachmentListProps {
  attachments: AttachmentItem[];
  isLoading?: boolean;
  onUpload?: (data: Partial<AttachmentItem>) => Promise<any>;
  onDelete?: (id: string) => Promise<any>;
  entityType?: UniversalEntityType | string;
  entityId?: string;
  entityCode?: string;
  projectId?: string;
  projectCode?: string;
  className?: string;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments = [],
  isLoading = false,
  onUpload,
  onDelete,
  entityType = 'version',
  entityId = 'ver-001',
  entityCode = 'CYBER_HERO_BODY_v004',
  projectId = 'proj-001',
  projectCode = 'NK99',
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [previewItem, setPreviewItem] = useState<AttachmentItem | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState<boolean>(false);

  const filteredAttachments = useMemo(() => {
    return attachments.filter((item) => {
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch =
        searchQuery === '' ||
        item.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [attachments, selectedCategory, searchQuery]);

  const categories = ['ALL', ...Array.from(new Set(attachments.map((a) => a.category)))];

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('JSON') || fileType.includes('Code') || fileType.includes('Config')) {
      return <FileCode className="w-4 h-4 text-cyan-400" />;
    }
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search attachments, specs, reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        </div>

        {onUpload && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsUploaderOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="font-mono text-xs self-end sm:self-auto"
          >
            Attach File
          </Button>
        )}
      </div>

      {/* Attachments List Display */}
      {filteredAttachments.length === 0 ? (
        <EmptyState
          icon={<Paperclip className="w-10 h-10 text-slate-600" />}
          title="No Attachments Found"
          description={`No production attachments linked to this ${entityType}. Upload breakdown sheets, camera reports, lookdev files, or specs.`}
          actionLabel={onUpload ? "Upload First Attachment" : undefined}
          onAction={() => setIsUploaderOpen(true)}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 shadow-sm">
          {filteredAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-3.5 hover:bg-slate-800/40 transition-colors group"
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className="mt-0.5 p-2 rounded-lg bg-slate-950 border border-slate-800 flex-shrink-0">
                  {getFileIcon(att.file_type)}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span
                      onClick={() => setPreviewItem(att)}
                      className="text-xs font-mono font-semibold text-slate-200 hover:text-blue-400 cursor-pointer truncate"
                      title={att.file_name}
                    >
                      {att.file_name}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                      {att.category}
                    </Badge>
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/30">
                      {att.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{att.description || 'Production reference document.'}</p>
                  <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500">
                    <span>{Math.round(att.file_size_kb / 1024 * 10) / 10} MB</span>
                    <span>•</span>
                    <span>By {att.uploaded_by}</span>
                    <span>•</span>
                    <span>{new Date(att.uploaded_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setPreviewItem(att)}
                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                  className="font-mono text-xs"
                >
                  Preview
                </Button>
                <AttachmentDownload attachment={att} variant="icon" />
                {onDelete && (
                  <button
                    onClick={() => onDelete(att.id)}
                    className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Attachment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <AttachmentPreview
        attachment={previewItem}
        isOpen={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
      />

      {/* Uploader Modal */}
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
