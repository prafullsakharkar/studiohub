import React, { useState, useMemo } from 'react';
import {
  Grid,
  List,
  LayoutGrid,
  Search,
  Filter,
  Film,
  Image as ImageIcon,
  Music,
  Layers,
  Sparkles,
  Download,
  Plus,
  Trash2,
  Maximize2,
} from 'lucide-react';
import { MediaItem, MediaType } from '@/types/media';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaViewer } from './MediaViewer';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Modal } from '../Modal';
import { EmptyState } from '../EmptyState';

interface MediaGridProps {
  items: MediaItem[];
  isLoading?: boolean;
  onUploadClick?: () => void;
  onDeleteClick?: (id: string) => void;
  className?: string;
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  items = [],
  isLoading = false,
  onUploadClick,
  onDeleteClick,
  className = '',
}) => {
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'cards' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesType = activeTypeFilter === 'ALL' || item.media_type.toLowerCase() === activeTypeFilter.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.file_format.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [items, activeTypeFilter, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        {/* Left: Search & Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search media files, AOVs, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Type Filters */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            {[
              { id: 'ALL', label: 'All Media', icon: null },
              { id: 'video', label: 'Video', icon: <Film className="w-3 h-3 mr-1" /> },
              { id: 'image', label: 'Images / HDRI', icon: <ImageIcon className="w-3 h-3 mr-1" /> },
              { id: 'audio', label: 'Audio', icon: <Music className="w-3 h-3 mr-1" /> },
              { id: 'sequence', label: 'Sequences', icon: <Layers className="w-3 h-3 mr-1" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTypeFilter(tab.id)}
                className={`flex items-center px-2.5 py-1 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                  activeTypeFilter === tab.id
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Layout Switcher & Action Button */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {/* Layout switcher */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                layoutMode === 'grid' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode('cards')}
              className={`p-1.5 rounded transition-colors ${
                layoutMode === 'cards' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Large cards view"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode('list')}
              className={`p-1.5 rounded transition-colors ${
                layoutMode === 'list' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {onUploadClick && (
            <Button
              size="sm"
              variant="primary"
              onClick={onUploadClick}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="font-mono text-xs"
            >
              Upload Media
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-950/40 border border-blue-500/30 rounded-lg animate-in fade-in">
          <div className="flex items-center space-x-2">
            <Badge variant="info" className="font-mono text-xs">
              {selectedIds.length} Selected
            </Badge>
            <button
              onClick={selectAll}
              className="text-xs font-mono text-blue-400 hover:text-blue-300 underline"
            >
              {selectedIds.length === filteredItems.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />}>
              Download Batch
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (onDeleteClick) {
                  selectedIds.forEach((id) => onDeleteClick(id));
                  setSelectedIds([]);
                }
              }}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Media Items Display */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<Film className="w-10 h-10 text-slate-600" />}
          title="No Media Assets Found"
          description="No media matches the current filter criteria. Upload images, videos, audio, or sequences to populate this workspace."
          actionLabel={onUploadClick ? "Upload Media" : undefined}
          onAction={onUploadClick}
        />
      ) : layoutMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <MediaThumbnail
              key={item.id}
              media={item}
              size="md"
              isSelected={selectedIds.includes(item.id)}
              onSelect={() => toggleSelect(item.id)}
              onClick={() => setPreviewMedia(item)}
            />
          ))}
        </div>
      ) : layoutMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm group">
              <MediaThumbnail
                media={item}
                size="lg"
                isSelected={selectedIds.includes(item.id)}
                onSelect={() => toggleSelect(item.id)}
                onClick={() => setPreviewMedia(item)}
              />
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-200 truncate">{item.name}</span>
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                    {item.color_space}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{item.description || 'No description provided.'}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-500">
                  <span>Uploaded by {item.uploaded_by}</span>
                  <span>{item.file_size_mb} MB</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Mode */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setPreviewMedia(item)}
              className="flex items-center justify-between p-3 hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(item.id);
                  }}
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                />
                <img
                  src={item.thumbnail_url}
                  alt={item.name}
                  className="w-12 h-8 rounded object-cover border border-slate-800 flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-semibold text-slate-200 truncate">{item.name}</span>
                    <Badge variant="outline" className="text-[10px] text-slate-400">
                      {item.media_type}
                    </Badge>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {item.file_format} • {item.resolution || 'HD'} • {item.color_space}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-4 flex-shrink-0 ml-4 font-mono text-xs text-slate-400">
                <span className="hidden sm:inline-block">{item.file_size_mb} MB</span>
                <span className="hidden md:inline-block text-slate-500">{item.uploaded_by}</span>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewMedia(item);
                  }}
                >
                  Inspect
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspector / Viewer Modal */}
      <Modal
        isOpen={Boolean(previewMedia)}
        onClose={() => setPreviewMedia(null)}
        title={previewMedia?.name || 'Studio Media Viewer'}
        size="2xl"
      >
        {previewMedia && (
          <div className="space-y-4">
            <MediaViewer
              media={previewMedia}
              startFrame={previewMedia.start_frame || 1001}
              endFrame={previewMedia.end_frame || 1086}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setPreviewMedia(null)}>
                Close Viewer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
