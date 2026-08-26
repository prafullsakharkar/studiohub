import React, { useState } from 'react';
import {
  Bookmark,
  Star,
  Share2,
  MoreVertical,
  Plus,
  Copy,
  Edit2,
  Trash2,
  Check,
  Globe,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  Kanban,
  Calendar as CalendarIcon,
  Clock,
  Network,
  Image,
} from 'lucide-react';
import { SavedView, EntityType, DataViewMode } from '@/types/crud';
import { savedViewsStore } from './savedViewsStore';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface SavedViewsBarProps {
  entityType: EntityType;
  activeViewId: string;
  activeViewMode: DataViewMode;
  onSelectView: (view: SavedView) => void;
  onChangeViewMode: (mode: DataViewMode) => void;
  onSaveCurrentAsView?: () => void;
  className?: string;
}

const VIEW_MODE_ICONS: Record<DataViewMode, React.ComponentType<{ className?: string }>> = {
  table: TableIcon,
  grid: LayoutGrid,
  board: Kanban,
  timeline: Clock,
  calendar: CalendarIcon,
  hierarchy: Network,
  gallery: Image,
};

export const SavedViewsBar: React.FC<SavedViewsBarProps> = ({
  entityType,
  activeViewId,
  activeViewMode,
  onSelectView,
  onChangeViewMode,
  onSaveCurrentAsView,
  className = '',
}) => {
  const [views, setViews] = useState<SavedView[]>(() =>
    savedViewsStore.getViewsForEntity(entityType)
  );
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameModalView, setRenameModalView] = useState<SavedView | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [newViewModalOpen, setNewViewModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const refreshViews = () => {
    setViews(savedViewsStore.getViewsForEntity(entityType));
  };

  const activeView = views.find((v) => v.id === activeViewId) || views[0];

  const handleToggleFavorite = (viewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    savedViewsStore.toggleFavorite(viewId);
    refreshViews();
  };

  const handleDuplicate = (viewId: string) => {
    const dup = savedViewsStore.duplicateView(viewId);
    if (dup) {
      refreshViews();
      onSelectView(dup);
    }
    setMenuOpenId(null);
  };

  const handleSetDefault = (viewId: string) => {
    savedViewsStore.setDefault(viewId);
    refreshViews();
    setMenuOpenId(null);
  };

  const handleToggleShare = (viewId: string) => {
    savedViewsStore.toggleShared(viewId);
    refreshViews();
    setMenuOpenId(null);
  };

  const handleDelete = (viewId: string) => {
    if (views.length <= 1) return;
    savedViewsStore.deleteView(viewId);
    const updated = savedViewsStore.getViewsForEntity(entityType);
    setViews(updated);
    if (activeViewId === viewId && updated.length > 0) {
      onSelectView(updated[0]);
    }
    setMenuOpenId(null);
  };

  const handleConfirmRename = () => {
    if (renameModalView && renameInput.trim()) {
      savedViewsStore.renameView(renameModalView.id, renameInput.trim());
      refreshViews();
      setRenameModalView(null);
    }
  };

  const handleCreateNewView = () => {
    if (!newViewName.trim()) return;
    const created = savedViewsStore.createView({
      name: newViewName.trim(),
      entityType,
      viewMode: activeViewMode,
      filters: activeView?.filters || { id: 'root', logicalOperator: 'AND', conditions: [] },
      sort: activeView?.sort || [],
      visibleColumns: activeView?.visibleColumns || [],
      groupBy: activeView?.groupBy,
      isDefault: false,
      isFavorite: true,
      isShared: true,
      createdBy: 'Studio Artist',
    });
    refreshViews();
    onSelectView(created);
    setNewViewName('');
    setNewViewModalOpen(false);
  };

  const viewModes: DataViewMode[] = ['table', 'grid', 'board', 'timeline', 'calendar', 'hierarchy', 'gallery'];

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 ${className}`}>
      {/* Saved Views Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 mr-1.5 flex-shrink-0">
          <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
          <span>Views:</span>
        </div>

        {views.map((v) => {
          const isActive = v.id === activeView?.id;
          const ViewIcon = VIEW_MODE_ICONS[v.viewMode] || TableIcon;

          return (
            <div
              key={v.id}
              className={`group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex-shrink-0 ${
                isActive
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
              }`}
              onClick={() => {
                onSelectView(v);
                onChangeViewMode(v.viewMode);
              }}
            >
              <ViewIcon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
              <span className="truncate max-w-[130px]">{v.name}</span>

              {v.isDefault && (
                <span className="text-[9px] font-mono px-1 rounded bg-slate-700 text-slate-300">
                  Default
                </span>
              )}

              {/* Quick favorite star */}
              <button
                type="button"
                onClick={(e) => handleToggleFavorite(v.id, e)}
                className={`p-0.5 rounded transition-colors ${
                  v.isFavorite
                    ? 'text-amber-400'
                    : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-400'
                }`}
                title={v.isFavorite ? 'Remove favorite' : 'Mark as favorite'}
              >
                <Star className={`w-3 h-3 ${v.isFavorite ? 'fill-amber-400' : ''}`} />
              </button>

              {/* View options context menu button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === v.id ? null : v.id);
                }}
                className="p-0.5 rounded text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-3 h-3" />
              </button>

              {/* Dropdown Menu */}
              {menuOpenId === v.id && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-50 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-1 w-44 space-y-0.5 text-left text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setRenameModalView(v);
                      setRenameInput(v.name);
                      setMenuOpenId(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Rename View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicate(v.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Duplicate View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetDefault(v.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Set as Default</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleShare(v.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{v.isShared ? 'Make Private' : 'Share with Studio'}</span>
                  </button>

                  {views.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete View</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Create View Button */}
        <button
          type="button"
          onClick={() => {
            setNewViewName(`New ${activeViewMode} View`);
            setNewViewModalOpen(true);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-dashed border-slate-700 transition-colors flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save View</span>
        </button>
      </div>

      {/* View Mode Switcher Toolbar */}
      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 flex-shrink-0">
        {viewModes.map((mode) => {
          const Icon = VIEW_MODE_ICONS[mode];
          const isActive = activeViewMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeViewMode(mode)}
              className={`p-1.5 rounded-md transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={`Switch to ${mode.toUpperCase()} view`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          );
        })}
      </div>

      {/* Rename Modal */}
      <Modal
        isOpen={!!renameModalView}
        onClose={() => setRenameModalView(null)}
        title="Rename Saved View"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setRenameModalView(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmRename}>
              Save Name
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            View Name
          </label>
          <input
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            autoFocus
          />
        </div>
      </Modal>

      {/* New View Modal */}
      <Modal
        isOpen={newViewModalOpen}
        onClose={() => setNewViewModalOpen(false)}
        title="Create Saved View"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setNewViewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateNewView}>
              Create View
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              View Name
            </label>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g. My Active Tasks, 4K Shot Reviews..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          <p className="text-xs text-slate-400">
            This will preserve current filters, sorting preferences, column arrangement, and the active <span className="font-semibold text-indigo-400 capitalize">{activeViewMode}</span> display mode.
          </p>
        </div>
      </Modal>
    </div>
  );
};
