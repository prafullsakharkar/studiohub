import React, { useState } from 'react';
import { ReviewSession } from '@/types/reviews';
import { Button } from '@/shared/components/Button';
import { Film, Sparkles, X, Building, Monitor, User } from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface CreateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ReviewSession>) => Promise<any>;
  isLoading?: boolean;
}

export const CreateReviewModal: React.FC<CreateReviewModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [projectCode, setProjectCode] = useState('NK99');
  const [entityType, setEntityType] = useState<'Shot' | 'Asset'>('Shot');
  const [entityCode, setEntityCode] = useState('NK_010_010');
  const [versionNumber, setVersionNumber] = useState('v001');
  const [department, setDepartment] = useState('Compositing');
  const [description, setDescription] = useState('');
  const [resolution, setResolution] = useState('4096x2160');
  const [fps, setFps] = useState<number>(24);
  const [totalFrames, setTotalFrames] = useState<number>(144);
  const [clientName, setClientName] = useState('Warner Bros. Discovery');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || `${entityCode} (${versionNumber}) - ${department} Review`;

    await onSubmit({
      title: finalTitle,
      project_id: projectCode === 'NK99' ? 'proj-001' : 'proj-002',
      project_code: projectCode,
      project_name: projectCode === 'NK99' ? 'Neo Kyoto 2099' : 'Aetheria Chronicles Season 2',
      entity_type: entityType,
      entity_code: entityCode,
      version_number: versionNumber,
      department,
      description,
      resolution,
      fps,
      total_frames: totalFrames,
      frame_range: `1001 - ${1000 + totalFrames}`,
      color_space: 'ACEScg (AP1)',
      dcc_software: 'Nuke / Maya',
      status: 'Draft',
      lead_reviewer_name: user?.full_name || 'Alex Chen',
      lead_reviewer_id: user?.id || 'usr-001',
      client: {
        id: 'cli-001',
        code: 'WARNER-MEDIA',
        name: clientName,
        representative_name: 'Michael Sterling',
        contact_email: 'm.sterling@warner.com',
        access_level: 'Full Review',
      },
      versions: [
        {
          id: `ver-${Date.now()}`,
          version_number: versionNumber,
          video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
          artist_name: user?.full_name || 'Alex Chen',
          status: 'Draft',
          is_hero: true,
          resolution,
          fps,
          total_frames: totalFrames,
          created_at: new Date().toISOString(),
        },
      ],
      reviewers: [
        {
          id: `rev-p-${Date.now()}`,
          user_id: user?.id || 'usr-001',
          name: user?.full_name || 'Alex Chen',
          avatar: user?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
          email: user?.email || 'supervisor@studiohub.vfx',
          role: user?.role || 'VFX Supervisor',
          verdict: 'Pending',
          is_required: true,
        },
      ],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create New Review Session</h3>
              <p className="text-[11px] text-slate-400">
                Initialize screening room session for shot/asset turnover cut.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Project & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Project</label>
              <select
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              >
                <option value="NK99">Neo Kyoto 2099 (NK99)</option>
                <option value="AETH2">Aetheria Chronicles S2 (AETH2)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              >
                <option value="Compositing">Compositing</option>
                <option value="Lighting & LookDev">Lighting & LookDev</option>
                <option value="FX & Simulation">FX & Simulation</option>
                <option value="Character Animation">Character Animation</option>
                <option value="Environment & Matte">Environment & Matte</option>
              </select>
            </div>
          </div>

          {/* Entity Type & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              >
                <option value="Shot">Shot</option>
                <option value="Asset">Asset</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Entity Code</label>
              <input
                type="text"
                value={entityCode}
                onChange={(e) => setEntityCode(e.target.value)}
                placeholder="e.g. NK_010_010"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Version Number</label>
              <input
                type="text"
                value={versionNumber}
                onChange={(e) => setVersionNumber(e.target.value)}
                placeholder="e.g. v001"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                required
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Session Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g. ${entityCode} (${versionNumber}) - ${department} Review`}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Turnover Objectives & Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail what changes were made in this iteration and what feedback is requested..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Tech Specs */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Resolution</label>
              <input
                type="text"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">FPS</label>
              <input
                type="number"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Frames</label>
              <input
                type="number"
                value={totalFrames}
                onChange={(e) => setTotalFrames(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white"
              />
            </div>
          </div>

          {/* Client Account */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Client Organization</label>
            <select
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
            >
              <option value="Warner Bros. Discovery">Warner Bros. Discovery (Michael Sterling)</option>
              <option value="Netflix Originals">Netflix Originals (Amanda Vance)</option>
              <option value="Universal Pictures">Universal Pictures (David Miller)</option>
            </select>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              className="text-xs border-slate-700 text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isLoading}
              className="text-xs bg-indigo-600 hover:bg-indigo-500"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Create Review Session
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
