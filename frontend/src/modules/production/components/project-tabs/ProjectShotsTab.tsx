import React, { useState } from 'react';
import {
  Film,
  Plus,
  LayoutGrid,
  List,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { Project } from '@/mocks/db/production/projects';
import { useShots } from '@/modules/shots/hooks/useShots';
import { useShotMutations } from '@/modules/shots/hooks/useShotMutations';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Modal } from '@/shared/components/Modal';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';
import { Link } from 'react-router-dom';
import { Shot } from '@/mocks/db/production/shots';
import { ProductionStatus } from '@/types/common';

interface ProjectShotsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectShotsTab: React.FC<ProjectShotsTabProps> = ({ project }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const openInspector = useInspectorStore((state) => state.openInspector);

  const { data: shotsData, isLoading } = useShots({
    project_id: project.id,
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    page_size: 50,
  });

  const { createShot, updateShot, isCreating } = useShotMutations();

  const [formData, setFormData] = useState({
    code: `${project.code}_010_`,
    name: '',
    sequence_code: `${project.code}_010`,
    description: '',
    frame_in: 1001,
    frame_out: 1120,
    handle_frames: 8,
    assigned_artist_name: 'Elena Rostova',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const frame_count = formData.frame_out - formData.frame_in + 1;
    await createShot({
      ...formData,
      frame_count,
      project_id: project.id,
      project_code: project.code,
      status: 'Not Started',
      current_version: 'v001',
      supervisor_approved: false,
      client_approved: false,
      thumbnail_url:
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      pipeline: {
        layout: 'Not Started',
        animation: 'Not Started',
        fx: 'Not Started',
        lighting: 'Not Started',
        comp: 'Not Started',
      },
    } as Partial<Shot>);
    setIsCreateOpen(false);
  };

  const shots = shotsData?.results || [];

  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shot code or description..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-indigo-500"
          >
            <option value="ALL">All Shot Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Retake">Retake</option>
          </select>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Dense Table Matrix"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            New Shot
          </Button>

          <Link to="/shots">
            <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>
              Global Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading show shots..." />
      ) : shots.length === 0 ? (
        <EmptyState
          icon={<Film className="w-8 h-8 text-indigo-400" />}
          title="No Shots Found for this Show"
          description="Register shots to begin plate ingest and artist task tracking."
          actionLabel="Create Shot"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shots.map((shot) => (
            <Card
              key={shot.id}
              onClick={() => openInspector('shot', shot)}
              className="bg-slate-900 border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer overflow-hidden flex flex-col justify-between group"
            >
              <div className="relative h-36 bg-slate-950 overflow-hidden">
                <img
                  src={shot.thumbnail_url}
                  alt={shot.code}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                <div className="absolute top-2 left-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900/90 text-white border border-slate-700">
                    {shot.code}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <StatusBadge status={shot.status} />
                </div>
                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-slate-300">
                  <span>
                    Frames: {shot.frame_in} - {shot.frame_out} ({shot.frame_count}f)
                  </span>
                  <span className="text-indigo-400 font-bold">{shot.current_version}</span>
                </div>
              </div>

              <CardBody className="p-3.5 space-y-2">
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{shot.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                  <span>
                    Artist: <strong className="text-slate-200">{shot.assigned_artist_name || 'Unassigned'}</strong>
                  </span>
                  <span className="text-indigo-400 text-[10px] font-mono group-hover:underline">Inspect Shot →</span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                  <th className="py-2.5 px-3">Shot Code</th>
                  <th className="py-2.5 px-3">Sequence</th>
                  <th className="py-2.5 px-3">Frame Range</th>
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Artist</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {shots.map((shot) => (
                  <tr
                    key={shot.id}
                    onClick={() => openInspector('shot', shot)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-white flex items-center gap-2">
                      <img
                        src={shot.thumbnail_url}
                        alt={shot.code}
                        className="w-10 h-7 rounded object-cover border border-slate-800"
                      />
                      <span>{shot.code}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{shot.sequence_code}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {shot.frame_in} - {shot.frame_out} ({shot.frame_count}f)
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-400 font-bold">{shot.current_version}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={shot.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{shot.assigned_artist_name || 'Unassigned'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button className="p-1 rounded text-slate-400 hover:text-indigo-300">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Shot Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Initialize New VFX Shot"
        subtitle={`Adding shot to project ${project.name} (${project.code})`}
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Shot Code</label>
              <input
                required
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. NK_010_010"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Sequence Code</label>
              <input
                required
                type="text"
                value={formData.sequence_code}
                onChange={(e) => setFormData({ ...formData, sequence_code: e.target.value.toUpperCase() })}
                placeholder="e.g. NK_010"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description & VFX Action</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Action summary, background plate details, and required CG elements..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Frame In</label>
              <input
                type="number"
                value={formData.frame_in}
                onChange={(e) => setFormData({ ...formData, frame_in: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Frame Out</label>
              <input
                type="number"
                value={formData.frame_out}
                onChange={(e) => setFormData({ ...formData, frame_out: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Handles (Frames)</label>
              <input
                type="number"
                value={formData.handle_frames}
                onChange={(e) => setFormData({ ...formData, handle_frames: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Assigned Lead Artist</label>
            <input
              type="text"
              value={formData.assigned_artist_name}
              onChange={(e) => setFormData({ ...formData, assigned_artist_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isCreating}>
              Create Shot
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
