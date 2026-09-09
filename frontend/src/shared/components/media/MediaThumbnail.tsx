import React, { useState } from 'react';
import { Film, Image as ImageIcon, Music, Layers, Play, CheckCircle2 } from 'lucide-react';
import { MediaItem, MediaType } from '@/types/media';
import { Badge } from '../Badge';

interface MediaThumbnailProps {
  media?: Partial<MediaItem>;
  thumbnailUrl?: string;
  videoUrl?: string;
  name?: string;
  mediaType?: MediaType;
  resolution?: string;
  duration?: string | number;
  frameCount?: number;
  colorSpace?: string;
  aspectRatio?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  media,
  thumbnailUrl,
  videoUrl,
  name,
  mediaType,
  resolution,
  duration,
  frameCount,
  colorSpace,
  aspectRatio = '16/9',
  isSelected = false,
  onSelect,
  onClick,
  className = '',
  size = 'md',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const resolvedThumb = thumbnailUrl || media?.thumbnail_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600';
  const resolvedVideo = videoUrl || media?.preview_url || media?.source_url;
  const resolvedType: MediaType = mediaType || media?.media_type || 'video';
  const resolvedName = name || media?.name || 'Media Asset';
  const resolvedResolution = resolution || media?.resolution;
  const resolvedColorSpace = colorSpace || media?.color_space || 'ACEScg';
  const resolvedFrames = frameCount || media?.frame_count;

  const sizeClasses = {
    sm: 'h-28 text-xs',
    md: 'h-44 text-xs',
    lg: 'h-64 text-sm',
  }[size];

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case 'video':
        return <Film className="w-3 h-3" />;
      case 'audio':
        return <Music className="w-3 h-3" />;
      case 'image':
        return <ImageIcon className="w-3 h-3" />;
      case 'sequence':
        return <Layers className="w-3 h-3" />;
      default:
        return <Film className="w-3 h-3" />;
    }
  };

  return (
    <div
      className={`group relative rounded-lg overflow-hidden border transition-all duration-200 cursor-pointer select-none bg-slate-900 ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10'
          : 'border-slate-800 hover:border-slate-700 hover:shadow-md'
      } ${sizeClasses} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Background Media Element */}
      {isHovered && resolvedType === 'video' && resolvedVideo ? (
        <video
          src={resolvedVideo}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <img
          src={resolvedThumb}
          alt={resolvedName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      )}

      {/* Dark Gradient Overlay for Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/40 pointer-events-none" />

      {/* Top Left: Media Type & Format */}
      <div className="absolute top-2 left-2 flex items-center space-x-1.5 z-10">
        <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur border border-slate-700/80 text-[10px] font-mono text-slate-200 font-medium uppercase">
          {getMediaIcon(resolvedType)}
          <span>{resolvedType}</span>
        </div>
        {media?.file_format && (
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-900/80 text-[9px] font-mono text-slate-400 border border-slate-800">
            {media.file_format.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Top Right: Selection Checkbox */}
      {onSelect && (
        <div
          className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-slate-900/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 bg-slate-900/60 text-transparent hover:border-slate-400'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Center Play Icon Overlay on Hover */}
      {resolvedType === 'video' && !isHovered && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-blue-600/80 backdrop-blur text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Bottom Information Panel */}
      <div className="absolute bottom-2 left-2 right-2 flex flex-col space-y-0.5 z-10">
        <span className="text-xs font-semibold text-slate-200 truncate font-mono" title={resolvedName}>
          {resolvedName}
        </span>
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>{resolvedResolution || 'HD'}</span>
          {resolvedFrames ? (
            <span className="text-cyan-400">{resolvedFrames} frames</span>
          ) : duration ? (
            <span className="text-cyan-400">{duration}s</span>
          ) : (
            <span className="text-slate-400">{resolvedColorSpace}</span>
          )}
        </div>
      </div>
    </div>
  );
};
