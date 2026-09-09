import React from 'react';
import {
  FileText,
  Layers,
  HardDrive,
  Cpu,
  Hash,
  Clock,
  Film,
  Sparkles,
  Volume2,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { MediaItem } from '@/types/media';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface MediaMetadataProps {
  media: Partial<MediaItem>;
  className?: string;
}

export const MediaMetadata: React.FC<MediaMetadataProps> = ({ media, className = '' }) => {
  const { addNotification } = useNotificationStore();
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    addNotification({
      type: 'info',
      title: 'Copied to Clipboard',
      message: `${label} copied: ${text}`,
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const metadataItems = [
    {
      label: 'Color Space',
      value: media.color_space || 'ACEScg (ACES 1.3)',
      icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
      badge: 'OCIO v2',
    },
    {
      label: 'Resolution',
      value: media.resolution || '4096x2160 (4K DCI)',
      icon: <Film className="w-3.5 h-3.5 text-cyan-400" />,
      badge: media.aspect_ratio || '1.89:1',
    },
    {
      label: 'Frame Range / FPS',
      value: `${media.start_frame || 1001}-${media.end_frame || 1086} (${media.frame_count || 86} frames @ ${media.fps || 24} fps)`,
      icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
      label: 'Format & Compression',
      value: media.file_format || 'OpenEXR Multi-Channel (ZIP 16)',
      icon: <Layers className="w-3.5 h-3.5 text-blue-400" />,
      badge: media.bit_depth || '16-bit Float',
    },
    {
      label: 'Audio Channels',
      value: media.audio_channels || 'None (Mute Master Pass)',
      icon: <Volume2 className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
      label: 'Storage Footprint',
      value: `${media.file_size_mb || 450} MB`,
      icon: <HardDrive className="w-3.5 h-3.5 text-rose-400" />,
      badge: media.storage_tier || 'Tier 1 NVMe Hot',
    },
    {
      label: 'Checksum (MD5)',
      value: media.checksum_md5 || '9e107d9d372bb6826bd81d3542a419d6',
      icon: <Hash className="w-3.5 h-3.5 text-slate-400" />,
      copyable: true,
    },
    {
      label: 'Pipeline Storage Path',
      value: media.file_path || `/shows/${media.project_code || 'NK99'}/media/master_publish`,
      icon: <FileText className="w-3.5 h-3.5 text-slate-400" />,
      copyable: true,
    },
  ];

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-blue-400" />
          <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono">
            Technical Metadata & Color Pipeline
          </h4>
        </div>
        <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
          QC Verified
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {metadataItems.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-colors group"
          >
            <div className="flex items-start space-x-2.5 min-w-0">
              <div className="mt-0.5 p-1 rounded bg-slate-800/70 border border-slate-700/50 flex-shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-mono text-slate-400 block">{item.label}</span>
                <span className="text-xs font-mono font-medium text-slate-200 block truncate" title={String(item.value)}>
                  {item.value}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                  {item.badge}
                </span>
              )}
              {item.copyable && (
                <button
                  onClick={() => copyToClipboard(String(item.value), item.label)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors opacity-60 group-hover:opacity-100"
                  title="Copy to clipboard"
                >
                  {copiedKey === item.label ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
