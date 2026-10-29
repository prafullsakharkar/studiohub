import type React from 'react';
import { useState } from 'react';
import { Download, Check, Loader2 } from 'lucide-react';
import type { AttachmentItem } from '@/types/production';
import { cn } from '@/shared/utils/cn';
import { notify } from '@/core/notifications/notify';

export interface AttachmentDownloadProps {
  attachment: AttachmentItem;
  variant?: 'default' | 'compact' | 'button' | 'icon';
  className?: string;
}

export const AttachmentDownload: React.FC<AttachmentDownloadProps> = ({
  attachment,
  variant = 'default',
  className,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const fileName = attachment.file_name || attachment.name || 'attachment';
  const downloadUrl = attachment.download_url || attachment.url || attachment.preview_url;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);

    try {
      if (downloadUrl) {
        // Direct browser download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Simulated studio binary payload download
        const dummyContent = `Studio Attachment: ${fileName}\nID: ${attachment.id}\nCategory: ${attachment.category || 'General'}\nUploaded: ${attachment.uploaded_at || new Date().toISOString()}`;
        const blob = new Blob([dummyContent], { type: attachment.mime_type || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName.includes('.') ? fileName : `${fileName}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setIsDownloaded(true);
      notify.success(`Downloaded ${fileName}`);
      setTimeout(() => setIsDownloaded(false), 2000);
    } catch (err: any) {
      notify.error(`Failed to download ${fileName}: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (variant === 'compact' || variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        title={`Download ${fileName}`}
        aria-label={`Download ${fileName}`}
        className={cn(
          'p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300',
          'hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50',
          className
        )}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
        ) : isDownloaded ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
        'border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white',
        'transition-colors disabled:opacity-50',
        className
      )}
    >
      {isDownloading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
      ) : isDownloaded ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      <span>{isDownloaded ? 'Downloaded' : 'Download'}</span>
    </button>
  );
};

export default AttachmentDownload;
