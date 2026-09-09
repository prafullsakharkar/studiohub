import React, { useState } from 'react';
import { Film, Image as ImageIcon, Music, Layers, Upload, Plus } from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { MediaItem } from '@/types/media';
import { MediaViewer } from '@/shared/components/media/MediaViewer';
import { MediaMetadata } from '@/shared/components/media/MediaMetadata';
import { MediaGrid } from '@/shared/components/media/MediaGrid';
import { useMedia } from '@/modules/media/hooks/useMedia';
import { useMediaMutations } from '@/modules/media/hooks/useMediaMutations';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface VersionMediaTabProps {
  version: ProductionVersion;
}

export const VersionMediaTab: React.FC<VersionMediaTabProps> = ({ version }) => {
  const { data: mediaList = [], isLoading } = useMedia({
    entity_type: 'version',
    entity_id: version.id,
  });
  const { createMedia, deleteMedia } = useMediaMutations();

  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Fallback active media
  const currentMedia: Partial<MediaItem> = activeMedia || {
    id: `m-${version.id}`,
    name: `${version.version_number} - Beauty Master Comp`,
    media_type: version.media_type,
    preview_url: version.video_url || version.thumbnail_url,
    thumbnail_url: version.thumbnail_url,
    source_url: version.video_url,
    file_format: 'OpenEXR ZIP-16 (ACEScg)',
    resolution: version.resolution || '4096x2160',
    aspect_ratio: '1.89:1',
    fps: version.fps,
    start_frame: version.start_frame,
    end_frame: version.end_frame,
    frame_count: version.frame_count,
    color_space: version.color_space,
    file_size_mb: version.file_size_mb,
    storage_tier: 'NVMe Hot Scratch',
    bit_depth: '16-bit Half Float',
  };

  return (
    <div className="space-y-8">
      {/* Primary Viewport Area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Film className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-mono font-bold text-slate-200 uppercase">
              Viewport Review Player
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Current Pass: <strong className="text-white">{currentMedia.name}</strong>
          </span>
        </div>

        <MediaViewer
          media={currentMedia}
          startFrame={currentMedia.start_frame || version.start_frame}
          endFrame={currentMedia.end_frame || version.end_frame}
          fps={currentMedia.fps || version.fps}
          className="w-full"
        />
      </div>

      {/* Media Technical Metadata Inspector */}
      <MediaMetadata media={currentMedia} />

      {/* Associated Multi-Pass & AOV Renders Grid */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-200 font-mono">
              Render Passes, AOVs & Turntables
            </h4>
            <p className="text-xs text-slate-400">
              Explore multi-channel EXRs, beauty passes, cryptomatte buffers, and depth maps associated with {version.version_number}.
            </p>
          </div>
        </div>

        <MediaGrid
          items={mediaList}
          isLoading={isLoading}
          onUploadClick={() => setIsUploadModalOpen(true)}
          onDeleteClick={(id) => deleteMedia(id)}
        />
      </div>

      {/* Quick Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Render Pass / AOV"
        size="lg"
      >
        <div className="space-y-4 p-2">
          <p className="text-xs text-slate-400">
            Upload an auxiliary render buffer (Cryptomatte, Normals, Depth, Ambient Occlusion, or HDRI) to link to {version.version_number}.
          </p>
          <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center bg-slate-950/60">
            <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <span className="text-xs text-slate-300 font-mono block">
              Drag & Drop EXR, TIFF, MP4, or WAV files
            </span>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" size="sm" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await createMedia({
                  entity_type: 'version',
                  entity_id: version.id,
                  project_id: version.project_id,
                  project_code: version.project_code,
                  name: `${version.version_number} - Normal / Motion Pass`,
                  media_type: 'image',
                  file_format: 'OpenEXR 16-bit Float',
                  resolution: version.resolution || '4096x2160',
                  color_space: version.color_space || 'ACEScg',
                  thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600',
                  source_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600',
                  file_size_mb: 210,
                  storage_tier: 'NVMe Hot Scratch',
                  uploaded_by: 'Alex Vance',
                  tags: ['normals', 'motion-vectors'],
                });
                setIsUploadModalOpen(false);
              }}
            >
              Upload Pass
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
