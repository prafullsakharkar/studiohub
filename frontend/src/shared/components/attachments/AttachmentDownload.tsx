import React, { useState } from 'react';
import { Download, Copy, Check, ExternalLink, HardDrive, Share2 } from 'lucide-react';
import { AttachmentItem } from '@/types/attachments';
import { Button } from '../Button';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface AttachmentDownloadProps {
  attachment: AttachmentItem;
  variant?: 'button' | 'icon' | 'compact';
  className?: string;
}

export const AttachmentDownload: React.FC<AttachmentDownloadProps> = ({
  attachment,
  variant = 'button',
  className = '',
}) => {
  const { addNotification } = useNotificationStore();
  const [copiedLink, setCopiedLink] = useState(false);

  const handleDownload = () => {
    addNotification({
      type: 'success',
      title: 'Download Started',
      message: `Downloading ${attachment.file_name} (${Math.round(attachment.file_size_kb / 1024 * 10) / 10} MB)...`,
    });
  };

  const handleCopyLink = () => {
    const fakeCdnUrl = `https://cdn.studiohub.internal/shows/${attachment.project_code}/attachments/${attachment.file_name}`;
    navigator.clipboard.writeText(fakeCdnUrl);
    setCopiedLink(true);
    addNotification({
      type: 'info',
      title: 'Attachment URL Copied',
      message: 'Secure tokenized download link copied to clipboard.',
    });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (variant === 'icon') {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
          title={`Download ${attachment.file_name}`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleCopyLink}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Copy CDN Link"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <Button
        size="xs"
        variant="outline"
        onClick={handleDownload}
        leftIcon={<Download className="w-3 h-3" />}
        className={className}
      >
        Download
      </Button>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Button
        size="sm"
        variant="primary"
        onClick={handleDownload}
        leftIcon={<Download className="w-3.5 h-3.5" />}
      >
        Download File
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopyLink}
        leftIcon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
      >
        {copiedLink ? 'Copied Link' : 'Copy Link'}
      </Button>
    </div>
  );
};
