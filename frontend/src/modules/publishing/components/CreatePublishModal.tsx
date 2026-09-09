import React, { useState } from 'react';
import { PublishDestination, PublishItem } from '@/types/publishing';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { UploadCloud, Layers, Film, Box, HardDrive, Terminal } from 'lucide-react';

interface CreatePublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinations: PublishDestination[];
  onPublish: (data: Partial<PublishItem>) => Promise<PublishItem>;
}

export const CreatePublishModal: React.FC<CreatePublishModalProps> = ({
  isOpen,
  onClose,
  destinations,
  onPublish,
}) => {
  const { user } = useAuth();
  const [projectCode, setProjectCode] = useState('NK99');
  const [projectName, setProjectName] = useState('Neo Kyoto 2099');
  const [entityType, setEntityType] = useState<'Shot' | 'Asset'>('Shot');
  const [entityCode, setEntityCode] = useState('SH010');
  const [entityName, setEntityName] = useState('Tower Chase Aerials');
  const [department, setDepartment] = useState('Compositing');
  const [versionNumber, setVersionNumber] = useState('v001');
  const [dccSoftware, setDccSoftware] = useState<'Nuke' | 'Maya' | 'Houdini' | 'Blender' | 'Unreal' | 'USD'>('Nuke');
  const [frameRange, setFrameRange] = useState('1001-1144');
  const [colorSpace, setColorSpace] = useState('ACEScg (AP1 / Linear)');
  const [resolution, setResolution] = useState('4096x2160 (DCI 4K)');
  const [destinationId, setDestinationId] = useState(destinations[0]?.id || 'dest-001');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedDest = destinations.find((d) => d.id === destinationId) || destinations[0];
      await onPublish({
        project_code: projectCode,
        project_name: projectName,
        entity_type: entityType,
        entity_code: entityCode,
        entity_name: entityName,
        department,
        version_number: versionNumber,
        dcc_software: dccSoftware,
        frame_range: frameRange,
        color_space: colorSpace,
        resolution,
        destination: selectedDest,
        comment,
        artist_name: user?.full_name || 'Alex Chen',
        artist_avatar: user?.avatar_url,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="create-publish-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Publish New Entity Version to Pipeline"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Project</label>
            <select
              value={projectCode}
              onChange={(e) => {
                setProjectCode(e.target.value);
                setProjectName(e.target.value === 'NK99' ? 'Neo Kyoto 2099' : 'Aetheria Chronicles Season 2');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="NK99">Neo Kyoto 2099 (NK99)</option>
              <option value="ATH">Aetheria Chronicles Season 2 (ATH)</option>
              <option value="CBR">CyberRunner 2088 (CBR)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Entity Scope</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEntityType('Shot')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  entityType === 'Shot'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Film className="w-3.5 h-3.5" /> Shot
              </button>
              <button
                type="button"
                onClick={() => setEntityType('Asset')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  entityType === 'Asset'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" /> Asset
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {entityType === 'Shot' ? 'Shot Code (e.g. SH010)' : 'Asset Code (e.g. AST-MECH-01)'}
            </label>
            <input
              type="text"
              value={entityCode}
              onChange={(e) => setEntityCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Entity Descriptor</label>
            <input
              type="text"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Compositing">Compositing</option>
              <option value="Lighting">Lighting & LookDev</option>
              <option value="FX & Simulation">FX & Simulation</option>
              <option value="3D Modeling & Assets">3D Modeling</option>
              <option value="Animation">Animation</option>
              <option value="Rigging">Rigging</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">DCC Tool</label>
            <select
              value={dccSoftware}
              onChange={(e) => setDccSoftware(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="Nuke">Nuke</option>
              <option value="Maya">Maya</option>
              <option value="Houdini">Houdini</option>
              <option value="Blender">Blender</option>
              <option value="Unreal">Unreal Engine</option>
              <option value="USD">OpenUSD Stage</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Version Number</label>
            <input
              type="text"
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Frame Range</label>
            <input
              type="text"
              value={frameRange}
              onChange={(e) => setFrameRange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Publish Destination</label>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 truncate"
            >
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.protocol})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Artist Publish Comments / Changelog</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Document render passes, shader tweaks, or fixes for lead review..."
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Publishing Author:</span>
          <span className="text-white font-semibold">
            {user?.full_name || 'Alex Chen'} ({user?.role || 'VFX Supervisor'})
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={submitting}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
          >
            {submitting ? 'Executing Publish...' : 'Execute Publish'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
