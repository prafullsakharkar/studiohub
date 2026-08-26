import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Film,
  Upload,
  Eye,
  Download,
  Plus,
  Layers,
  Sparkles,
  Maximize2,
  FileImage,
  Tag,
} from 'lucide-react';
import { Asset } from '@/mocks/db/assets/assets';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { MediaViewer } from '@/shared/components/media/MediaViewer';
import { MediaMetadata } from '@/shared/components/media/MediaMetadata';
import { MediaGrid } from '@/shared/components/media/MediaGrid';
import { useMedia } from '@/modules/media/hooks/useMedia';
import { useMediaMutations } from '@/modules/media/hooks/useMediaMutations';

interface AssetMediaTabProps {
  asset: Asset;
}

export const AssetMediaTab: React.FC<AssetMediaTabProps> = ({ asset }) => {
  const { data: mediaItems = [], isLoading } = useMedia({
    entity_type: 'asset',
    entity_id: asset.id,
  });
  const { createMedia, deleteMedia } = useMediaMutations();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const heroMedia = {
    id: `m-hero-${asset.id}`,
    name: `${asset.name} - Turntable Render`,
    media_type: 'video' as const,
    source_url: asset.turntable_video_url,
    thumbnail_url: asset.thumbnail_url,
    resolution: '3840x2160 (4K UHD)',
    fps: 24,
    color_space: 'ACEScg',
    file_format: 'OpenEXR / ProRes 4444',
    file_size_mb: 245,
  };

  return (
    <div className="space-y-6">
      {/* Hero Media Viewport */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center">
            <Film className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
            Active Viewport Player
          </h3>
          <Badge variant="outline" className="text-[10px] font-mono text-cyan-400 border-cyan-500/30">
            ACEScg • 4K
          </Badge>
        </div>

        <MediaViewer
          title={`${asset.name} — LookDev Turnaround`}
          sourceUrl={asset.turntable_video_url}
          thumbnailUrl={asset.thumbnail_url}
          mediaType="video"
          colorSpace="ACEScg"
          resolution="3840x2160"
          fps={24}
          startFrame={1001}
          endFrame={1086}
        />
      </div>

      {/* Metadata breakdown */}
      <MediaMetadata media={heroMedia} />

      {/* Media Grid */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold text-slate-200 uppercase">
            Asset Media Library ({mediaItems.length})
          </h4>
        </div>
        <MediaGrid
          items={mediaItems}
          isLoading={isLoading}
          onUploadClick={() => setIsUploadOpen(true)}
          onDeleteClick={(id) => deleteMedia(id)}
        />
      </div>
    </div>
  );
};
