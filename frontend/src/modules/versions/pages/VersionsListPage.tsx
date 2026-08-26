import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GitBranch,
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List,
  Columns,
  Sparkles,
  Database,
  Film,
  CheckCircle2,
  ListMusic,
  Download,
  Calendar,
} from 'lucide-react';
import { useVersions } from '../hooks/useVersions';
import { useVersionMutations } from '../hooks/useVersionMutations';
import { ProductionVersion } from '@/types/versions';
import { MediaThumbnail } from '@/shared/components/media/MediaThumbnail';
import { MediaCompare } from '@/shared/components/media/MediaCompare';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Modal } from '@/shared/components/Modal';
import { EmptyState } from '@/shared/components/EmptyState';

export const VersionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [publishedFilter, setPublishedFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'table' | 'compare'>('grid');
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Version Form State
  const [newVersionNum, setNewVersionNum] = useState('v005');
  const [newCode, setNewCode] = useState('CYBER_HERO_BODY_v005');
  const [newDepartment, setNewDepartment] = useState('Compositing');
  const [newTaskName, setNewTaskName] = useState('Final Beauty Composite');
  const [newColorSpace, setNewColorSpace] = useState('ACEScg');
  const [newResolution, setNewResolution] = useState('4096x2160');

  const { data: versionsData, isLoading } = useVersions();
  const { createVersion, isCreating } = useVersionMutations();

  const versions = versionsData?.results || [];

  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      const artistName = v.artist?.name || v.artist_name || '';
      const taskName = v.task_name || v.task_title || '';
      const matchesSearch =
        searchQuery === '' ||
        v.version_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.project_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artistName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        taskName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = selectedDepartment === 'ALL' || v.department === selectedDepartment;
      const matchesStatus = selectedStatus === 'ALL' || v.status === selectedStatus;
      const matchesPub =
        publishedFilter === 'ALL' ||
        (publishedFilter === 'PUBLISHED' && v.is_published) ||
        (publishedFilter === 'DRAFT' && !v.is_published);

      return matchesSearch && matchesDept && matchesStatus && matchesPub;
    });
  }, [versions, searchQuery, selectedDepartment, selectedStatus, publishedFilter]);

  const departments = ['ALL', 'Modeling', 'Surfacing', 'Rigging', 'Animation', 'FX / Simulation', 'Lighting', 'Compositing'];

  const toggleSelect = (id: string) => {
    setSelectedVersionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await createVersion({
      project_id: 'proj-001',
      project_code: 'NK99',
      project_name: 'Neo-Kyoto 2099',
      shot_code: 'SH_0040',
      version_number: newVersionNum,
      code: newCode,
      department: newDepartment,
      task_name: newTaskName,
      status: 'ready_for_review',
      color_space: newColorSpace,
      resolution: newResolution,
      fps: 24,
      start_frame: 1001,
      end_frame: 1086,
      frame_count: 86,
      duration_seconds: 3.58,
      media_type: 'video',
      thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600',
      video_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1600',
      file_size_mb: 320,
      dcc_software: 'NukeX 15.0v2',
      artist: {
        id: 'usr-001',
        name: 'Alex Vance',
        role: 'Lead Compositor',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      },
      is_published: false,
      reviews_count: 0,
      notes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setIsCreateModalOpen(false);
    navigate(`/versions/${created.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading Production Versions...</span>
      </div>
    );
  }

  // Selected versions for compare mode
  const compareVersionA = versions.find((v) => v.id === selectedVersionIds[0]) || filteredVersions[0];
  const compareVersionB = versions.find((v) => v.id === selectedVersionIds[1]) || filteredVersions[1] || filteredVersions[0];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-white flex items-center">
            <GitBranch className="w-6 h-6 mr-2.5 text-blue-400" />
            Versions & Media Master Catalog
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Browse, review, compare, and publish production renders, multi-channel EXRs, and OpenUSD stages across all shows.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {selectedVersionIds.length >= 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLayoutMode('compare')}
              leftIcon={<Columns className="w-3.5 h-3.5" />}
              className="font-mono text-xs"
            >
              Compare Selected ({selectedVersionIds.length})
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="font-mono text-xs"
          >
            Create Version
          </Button>
        </div>
      </div>

      {/* Filter & Toolbar Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search version code, artist, show..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Department Filter Chips */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                  selectedDepartment === dept
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* View Modes */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                layoutMode === 'grid' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode('table')}
              className={`p-1.5 rounded transition-colors ${
                layoutMode === 'table' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode('compare')}
              className={`p-1.5 rounded transition-colors ${
                layoutMode === 'compare' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compare View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Secondary filters: Status & Publishing */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="approved">Approved</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="final_approved">Final Approved</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Publish State:</span>
            <select
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="ALL">All States</option>
              <option value="PUBLISHED">Published Only</option>
              <option value="DRAFT">Unpublished / Drafts</option>
            </select>
          </div>

          <span className="text-slate-500 ml-auto">
            Showing <strong className="text-slate-300">{filteredVersions.length}</strong> versions
          </span>
        </div>
      </div>

      {/* Main Content Render */}
      {filteredVersions.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="w-10 h-10 text-slate-600" />}
          title="No Versions Match Filters"
          description="Try modifying search criteria or create a new version."
          actionLabel="Create First Version"
          onAction={() => setIsCreateModalOpen(true)}
        />
      ) : layoutMode === 'compare' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">
              Interactive Split / Wipe / Difference Version Compare
            </span>
            <Button size="xs" variant="outline" onClick={() => setLayoutMode('grid')}>
              Back to Catalog Grid
            </Button>
          </div>
          <MediaCompare
            versionA={compareVersionA}
            versionB={compareVersionB}
            allVersions={versions}
          />
        </div>
      ) : layoutMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVersions.map((v) => (
            <div
              key={v.id}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm hover:border-slate-700 transition-all flex flex-col group"
            >
              {/* Media Thumbnail with playback / hover */}
              <div className="relative">
                <MediaThumbnail
                  media={{
                    name: `${v.version_number} - ${v.code}`,
                    thumbnail_url: v.thumbnail_url,
                    preview_url: v.video_url,
                    media_type: v.media_type,
                    resolution: v.resolution,
                    color_space: v.color_space,
                    frame_count: v.frame_count,
                  }}
                  size="md"
                  isSelected={selectedVersionIds.includes(v.id)}
                  onSelect={() => toggleSelect(v.id)}
                  onClick={() => navigate(`/versions/${v.id}`)}
                />
              </div>

              {/* Card Meta Content */}
              <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/versions/${v.id}`}
                      className="text-xs font-mono font-bold text-slate-200 hover:text-blue-400 truncate"
                    >
                      {v.version_number}
                    </Link>
                    <StatusBadge status={v.status} />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 block truncate" title={v.code}>
                    {v.code}
                  </span>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500">
                    <span className="text-slate-400">{v.department}</span>
                    <span>•</span>
                    <span className="text-cyan-400">{v.project_code}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <div className="flex items-center space-x-1.5 truncate">
                    <img
                      src={v.artist?.avatar || v.artist_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={v.artist?.name || v.artist_name || 'Artist'}
                      className="w-4 h-4 rounded-full flex-shrink-0"
                    />
                    <span className="truncate">{v.artist?.name || v.artist_name || 'Artist'}</span>
                  </div>
                  {v.is_published && (
                    <Badge variant="success" className="text-[9px] px-1 py-0 font-mono">
                      USD
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table Mode */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="p-3 w-8"></th>
                <th className="p-3">Version</th>
                <th className="p-3">Code / Task</th>
                <th className="p-3">Project</th>
                <th className="p-3">Department</th>
                <th className="p-3">Artist</th>
                <th className="p-3">Resolution / Color</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredVersions.map((v) => (
                <tr
                  key={v.id}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/versions/${v.id}`)}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedVersionIds.includes(v.id)}
                      onChange={() => toggleSelect(v.id)}
                      className="rounded border-slate-700 bg-slate-800 text-blue-600"
                    />
                  </td>
                  <td className="p-3 font-bold text-white">
                    <div className="flex items-center space-x-2">
                      <img
                        src={v.thumbnail_url}
                        alt={v.version_number}
                        className="w-10 h-7 rounded object-cover border border-slate-800"
                      />
                      <span>{v.version_number}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="block text-slate-200">{v.code}</span>
                    <span className="text-[10px] text-slate-500">{v.task_name || v.task_title || ''}</span>
                  </td>
                  <td className="p-3 text-cyan-400">{v.project_code}</td>
                  <td className="p-3">{v.department}</td>
                  <td className="p-3">
                    <div className="flex items-center space-x-1.5">
                      <img
                        src={v.artist?.avatar || v.artist_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={v.artist?.name || v.artist_name || 'Artist'}
                        className="w-4 h-4 rounded-full"
                      />
                      <span>{v.artist?.name || v.artist_name || 'Artist'}</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-400">
                    {v.resolution} • {v.color_space}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/versions/${v.id}`}>
                      <Button size="xs" variant="ghost">
                        Workspace
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Version Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Production Version" size="lg">
        <form onSubmit={handleCreateVersion} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Version Number</label>
              <input
                type="text"
                required
                value={newVersionNum}
                onChange={(e) => setNewVersionNum(e.target.value)}
                placeholder="e.g. v005"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Version Code</label>
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. CYBER_HERO_BODY_v005"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Department</label>
              <select
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {departments.filter((d) => d !== 'ALL').map((d) => (
                  <option key={d} value={d} className="bg-slate-900 text-slate-200">
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Task Stage Name</label>
              <input
                type="text"
                required
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Color Space</label>
              <select
                value={newColorSpace}
                onChange={(e) => setNewColorSpace(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="ACEScg">ACEScg (ACES 1.3)</option>
                <option value="Rec.709">Rec.709 Linear</option>
                <option value="LogC4">ARRI LogC4</option>
                <option value="sRGB">sRGB Display</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Resolution</label>
              <input
                type="text"
                value={newResolution}
                onChange={(e) => setNewResolution(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
              Create Version
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
