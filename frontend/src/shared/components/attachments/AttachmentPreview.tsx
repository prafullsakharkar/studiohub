import React from 'react';
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Lock,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { AttachmentItem } from '@/types/attachments';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Modal } from '../Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface AttachmentPreviewProps {
  attachment: AttachmentItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, isOpen, onClose }) => {
  const { addNotification } = useNotificationStore();
  const [copied, setCopied] = React.useState(false);

  if (!attachment) return null;

  const isCodeOrJson =
    attachment.file_type.includes('JSON') ||
    attachment.file_type.includes('Config') ||
    attachment.file_type.includes('Code') ||
    Boolean(attachment.raw_content);

  const isImage =
    attachment.file_type.includes('Image') ||
    attachment.file_type.includes('Grid') ||
    attachment.file_type.includes('PNG') ||
    attachment.file_type.includes('JPEG') ||
    Boolean(attachment.preview_url);

  const copyContent = () => {
    if (attachment.raw_content) {
      navigator.clipboard.writeText(attachment.raw_content);
      setCopied(true);
      addNotification({
        type: 'info',
        title: 'Copied Raw Content',
        message: 'Specification payload copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSecurityBadge = (sec: string) => {
    if (sec.includes('Confidential')) {
      return (
        <Badge variant="destructive" className="text-xs">
          <Lock className="w-3 h-3 mr-1" />
          {sec}
        </Badge>
      );
    }
    if (sec.includes('Internal')) {
      return (
        <Badge variant="warning" className="text-xs">
          <ShieldAlert className="w-3 h-3 mr-1" />
          {sec}
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="text-xs">
        <ShieldCheck className="w-3 h-3 mr-1" />
        {sec}
      </Badge>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={attachment.file_name} size="2xl">
      <div className="space-y-5">
        {/* Header Metadata Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Category:</span>
            <span className="text-slate-200 font-semibold">{attachment.category}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Size:</span>
            <span className="text-cyan-400 font-semibold">{Math.round(attachment.file_size_kb / 1024 * 10) / 10} MB</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Version:</span>
            <span className="text-purple-400 font-semibold">{attachment.version}</span>
          </div>
          <div>{getSecurityBadge(attachment.security_classification)}</div>
        </div>

        {/* Preview Content Area */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center p-4">
          {isImage && attachment.preview_url ? (
            <div className="flex flex-col items-center justify-center">
              <img
                src={attachment.preview_url}
                alt={attachment.file_name}
                className="max-h-[420px] w-auto object-contain rounded shadow-lg"
              />
            </div>
          ) : isCodeOrJson && attachment.raw_content ? (
            <div className="w-full">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>Inspectable Payload / Spec Content</span>
                <button
                  onClick={copyContent}
                  className="flex items-center space-x-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-900/90 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto max-h-[360px] border border-slate-800">
                {attachment.raw_content}
              </pre>
            </div>
          ) : (
            /* Document placeholder viewer */
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shadow-lg">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200 font-mono">{attachment.file_name}</h4>
              <p className="text-xs text-slate-400 max-w-md">
                {attachment.description || 'Production document manifest registered in studio cloud archive.'}
              </p>
              <div className="text-[11px] font-mono text-slate-500">
                Type: {attachment.file_type} • Uploaded by {attachment.uploaded_by} on {new Date(attachment.uploaded_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="text-xs font-mono text-slate-500">
            Entity Target: <strong className="text-slate-300">{attachment.entity_code}</strong> ({attachment.entity_type})
          </span>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                addNotification({
                  type: 'info',
                  title: 'Download Initiated',
                  message: `Downloading ${attachment.file_name}...`,
                });
              }}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Download File
            </Button>
            <Button size="sm" variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
