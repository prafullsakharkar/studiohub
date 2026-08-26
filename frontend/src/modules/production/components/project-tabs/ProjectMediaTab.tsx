import React, { useState } from 'react';
import {
  Film,
  HardDrive,
  Eye,
  Download,
  Share2,
  Maximize2,
  FileVideo,
  Image,
  Music,
  Plus,
  Terminal,
} from 'lucide-react';
import { Project } from '@/mocks/db/production/projects';
import { mockMediaAssets, MediaAsset } from '@/mocks/db/production/media';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectMediaTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectMediaTab: React.FC<ProjectMediaTabProps> = ({ project, onNavigateTab }) => {
  const [mediaList, setMediaList] = useState<MediaAsset[]>(
    mockMediaAssets.filter((m) => m.project_code === project.code || m.project_id === project.id).length > 0
      ? mockMediaAssets.filter((m) => m.project_code === project.code || m.project_id === project.id)
      : mockMediaAssets
  );

  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [formData, setFormData] = useState({
    title: '',
    media_type: 'Camera Plate' as any,
    file_name: '',
    file_format: 'ARRIRAW 6.5K',
    resolution: '6560x3100',
    color_space: 'ARRI LogC4 / Wide Gamut',
    description: '',
    associated_shot_code: 'NK_010_0010',
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newMedia: MediaAsset = {
      id: `med-${Date.now()}`,
      code: `MED-${formData.associated_shot_code || 'INGEST'}-${Date.now().toString().slice(-4)}`,
      title: formData.title,
      project_id: project.id,
      project_code: project.code,
      media_type: formData.media_type,
      file_name: formData.file_name || 'raw_plate_01.exr',
      file_format: formData.file_format,
      resolution: formData.resolution,
      color_space: formData.color_space,
      file_size_mb: 1420,
      thumbnail_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400',
      source_url: `s3://apex-storage-tier1/shows/${project.code}/plates/${formData.file_name}`,
      uploaded_by: 'Editorial Ingest TD',
      associated_shot_code: formData.associated_shot_code,
      description: formData.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMediaList([newMedia, ...mediaList]);
    setIsUploadModalOpen(false);
    addNotification({
      type: 'success',
      title: 'Media Asset Ingested',
      message: `Ingested ${formData.file_name} into ${project.code} storage tier.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            Source Media, Camera Raw Ingest & Reference Library
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            ARRIRAW camera plates, 32-bit HDRI environment captures, audio stems, and concept art
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsUploadModalOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Ingest Media
        </Button>
      </div>

      {/* Media Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mediaList.map((media) => (
          <div
            key={media.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="relative w-28 h-20 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 group">
                  <img
                    src={media.thumbnail_url}
                    alt={media.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <button
                    onClick={() => setSelectedMedia(media)}
                    className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-indigo-400">{media.code}</span>
                    <span className="px-2 py-0.2 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {media.media_type}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white leading-snug">{media.title}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {media.file_format} • {media.resolution || 'N/A'} • {media.file_size_mb} MB
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2">{media.description}</p>
            </div>

            {/* Storage Path */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="text-indigo-300 truncate max-w-[200px]" title={media.source_url}>
                {media.color_space}
              </span>
              <button
                onClick={() => setSelectedMedia(media)}
                className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Media Detail / Preview Modal */}
      {selectedMedia && (
        <Modal
          isOpen={Boolean(selectedMedia)}
          onClose={() => setSelectedMedia(null)}
          title={selectedMedia.title}
          subtitle={`${selectedMedia.media_type} • ${selectedMedia.file_format}`}
        >
          <div className="space-y-4">
            <div className="w-full h-56 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
              <img
                src={selectedMedia.thumbnail_url}
                alt={selectedMedia.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">File Name</span>
                <span className="text-white font-bold">{selectedMedia.file_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Color Space</span>
                <span className="text-indigo-400">{selectedMedia.color_space}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Resolution & Specs</span>
                <span className="text-white">{selectedMedia.resolution || 'N/A'} ({selectedMedia.file_size_mb} MB)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Storage URI</span>
                <span className="text-slate-300 break-all select-all">{selectedMedia.source_url}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300">{selectedMedia.description}</p>
          </div>
        </Modal>
      )}

      {/* Ingest Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Ingest Media / Plate Reference"
        subtitle={`Upload into show ${project.code} storage`}
      >
        <form onSubmit={handleUploadSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Media Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Arri Alexa 65 Plate Take 4"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Media Category</label>
              <select
                value={formData.media_type}
                onChange={(e) => setFormData({ ...formData, media_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Camera Plate">Camera Plate</option>
                <option value="Reference QuickTime">Reference QuickTime</option>
                <option value="Concept Art">Concept Art</option>
                <option value="Audio Stem">Audio Stem</option>
                <option value="HDRI Environment">HDRI Environment</option>
                <option value="LUT Profile">LUT Profile</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">File Name</label>
              <input
                type="text"
                required
                value={formData.file_name}
                onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
                placeholder="A004_C012_081832.ari"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsUploadModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Ingest Media
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
