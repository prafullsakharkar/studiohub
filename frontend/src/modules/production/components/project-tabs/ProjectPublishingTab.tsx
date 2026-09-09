import React, { useState } from 'react';
import {
  Layers,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Star,
  Plus,
  Copy,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { mockPublishRecords, PublishRecord } from '@/mocks/db/production/publishing';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectPublishingTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectPublishingTab: React.FC<ProjectPublishingTabProps> = ({ project, onNavigateTab }) => {
  const [publishes, setPublishes] = useState<PublishRecord[]>(
    mockPublishRecords.filter((p) => p.project_code === project.code || p.project_id === project.id).length > 0
      ? mockPublishRecords.filter((p) => p.project_code === project.code || p.project_id === project.id)
      : mockPublishRecords
  );

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [selectedPublish, setSelectedPublish] = useState<PublishRecord | null>(null);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [formData, setFormData] = useState({
    entity_code: 'NK_010_0010',
    entity_type: 'Shot' as 'Shot' | 'Asset' | 'Sequence',
    version_number: 'v005',
    department: 'Compositing',
    dcc_software: 'NukeX 15.0v2',
    comment: 'Refined rim-light composite on vehicle cockpit glass.',
    is_hero_promoted: true,
  });

  const handlePromoteHero = (pubId: string) => {
    setPublishes(
      publishes.map((p) =>
        p.id === pubId ? { ...p, is_hero_promoted: !p.is_hero_promoted } : p
      )
    );
    addNotification({
      type: 'success',
      title: 'OpenUSD Hero Layer Updated',
      message: 'USD composition arc updated in the show stage root.',
    });
  };

  const handlePublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: PublishRecord = {
      id: `pub-${Date.now()}`,
      project_id: project.id,
      project_code: project.code,
      entity_type: formData.entity_type,
      entity_id: 'shot-001',
      entity_code: formData.entity_code,
      version_number: formData.version_number,
      department: formData.department,
      publisher_name: 'Current Artist',
      publisher_id: 'usr-003',
      publisher_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      dcc_software: formData.dcc_software,
      dcc_version: '15.0',
      usd_stage_path: `@studio/shows/${project.code}/${formData.entity_type.toLowerCase()}s/${formData.entity_code}/${formData.department.toLowerCase()}/${formData.entity_code}_${formData.version_number}.usd`,
      usd_layer_identifier: `SdfLayerRef(@${formData.entity_code}_${formData.version_number}.usd@)`,
      pyblish_status: 'Passed',
      validation_errors: [],
      is_hero_promoted: formData.is_hero_promoted,
      file_size_mb: 780,
      published_at: new Date().toISOString(),
      comment: formData.comment,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setPublishes([newRecord, ...publishes]);
    setIsPublishModalOpen(false);
    addNotification({
      type: 'success',
      title: 'OpenUSD Layer Published Successfully',
      message: `${formData.entity_code} ${formData.version_number} validated through Pyblish.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            OpenUSD Stage Layer Registry & Pyblish Validation Feed
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Standardized multi-department USD sublayering, composition arcs, and Hero version promotion
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsPublishModalOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Publish Layer
        </Button>
      </div>

      {/* USD Sublayer List */}
      <div className="space-y-4">
        {publishes.map((pub) => (
          <div
            key={pub.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm">
                  {pub.version_number}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{pub.entity_code}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {pub.entity_type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {pub.department}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Authored in <strong className="text-slate-300 font-mono">{pub.dcc_software}</strong> by{' '}
                    <span className="text-indigo-300">{pub.publisher_name}</span> •{' '}
                    {new Date(pub.published_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => handlePromoteHero(pub.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                    pub.is_hero_promoted
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-amber-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                  title="Toggle Hero Layer in USD Root Stage"
                >
                  <Star className={`w-3 h-3 ${pub.is_hero_promoted ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span>{pub.is_hero_promoted ? 'Hero Active' : 'Promote Hero'}</span>
                </button>

                <span
                  className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-1 rounded ${
                    pub.pyblish_status === 'Passed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {pub.pyblish_status}
                </span>
              </div>
            </div>

            {/* Stage Path & Sublayer URI */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-indigo-400" /> OpenUSD Sublayer URI
                </span>
                <span className="text-slate-400">{pub.file_size_mb} MB</span>
              </div>
              <p className="text-indigo-300 text-[11px] break-all select-all font-mono">
                {pub.usd_stage_path}
              </p>
            </div>

            {pub.comment && (
              <p className="text-xs text-slate-300 italic bg-slate-950/40 p-2 rounded border border-slate-800/40">
                &ldquo;{pub.comment}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Publish Modal */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Publish OpenUSD Sublayer & Run Pyblish"
        subtitle={`Register authoring artifact for show ${project.code}`}
      >
        <form onSubmit={handlePublishSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Entity Code</label>
              <input
                type="text"
                required
                value={formData.entity_code}
                onChange={(e) => setFormData({ ...formData, entity_code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Entity Type</label>
              <select
                value={formData.entity_type}
                onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Shot">Shot</option>
                <option value="Asset">Asset</option>
                <option value="Sequence">Sequence</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Version Tag</label>
              <input
                type="text"
                required
                value={formData.version_number}
                onChange={(e) => setFormData({ ...formData, version_number: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Modeling">Modeling</option>
                <option value="Texturing & LookDev">Texturing & LookDev</option>
                <option value="Rigging">Rigging</option>
                <option value="Animation">Animation</option>
                <option value="FX & Simulation">FX & Simulation</option>
                <option value="Lighting">Lighting</option>
                <option value="Compositing">Compositing</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Authoring DCC Application</label>
            <input
              type="text"
              value={formData.dcc_software}
              onChange={(e) => setFormData({ ...formData, dcc_software: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Publish Comment & Notes</label>
            <textarea
              rows={2}
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="hero_promote_check"
              checked={formData.is_hero_promoted}
              onChange={(e) => setFormData({ ...formData, is_hero_promoted: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="hero_promote_check" className="text-xs text-slate-300 select-none">
              Promote this publish to Active Hero Sublayer in USD Root Stage
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsPublishModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Validate & Publish Layer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
