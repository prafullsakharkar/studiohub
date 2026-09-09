import React, { useState } from 'react';
import {
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  RotateCcw,
  Sparkles,
  GitBranch,
  FileCode,
  Lock,
} from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { useVersionMutations } from '../hooks/useVersionMutations';
import { Modal } from '@/shared/components/Modal';

interface VersionPublishingTabProps {
  version: ProductionVersion;
}

export const VersionPublishingTab: React.FC<VersionPublishingTabProps> = ({ version }) => {
  const { publishVersion, unpublishVersion, isPublishing, isUnpublishing } = useVersionMutations();
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [dccSoftware, setDccSoftware] = useState(version.dcc_software || 'Houdini Solaris 20.5');
  const [publishComment, setPublishComment] = useState('Final comp approved for episode assembly master.');

  const handlePublish = async () => {
    await publishVersion({
      id: version.id,
      payload: {
        dcc_software: dccSoftware,
        publisher_name: 'Alex Vance (Lead TD)',
        comment: publishComment,
      },
    });
    setIsPublishModalOpen(false);
  };

  const handleUnpublish = async () => {
    await unpublishVersion({
      id: version.id,
      payload: {
        user_name: 'Alex Vance (Lead TD)',
      },
    });
  };

  const layers = version.publishing_info?.layers || [
    'root.usda',
    'geometry.usdc',
    'materials_acescg.usda',
    'shading_variants.usda',
  ];

  return (
    <div className="space-y-6">
      {/* Publishing Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-mono font-bold text-slate-200 uppercase">
                  OpenUSD Pipeline Publisher
                </h3>
                <Badge variant={version.is_published ? 'success' : 'outline'} className="text-xs font-mono">
                  {version.is_published ? 'PUBLISHED' : 'UNPUBLISHED / DRAFT'}
                </Badge>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Stage: <strong className="text-cyan-400">{version.project_code}/shots/{version.shot_code || version.asset_code}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {version.is_published ? (
              <Button
                size="sm"
                variant="danger"
                onClick={handleUnpublish}
                isLoading={isUnpublishing}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="font-mono text-xs"
              >
                Unpublish Stage
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsPublishModalOpen(true)}
                isLoading={isPublishing}
                leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
                className="font-mono text-xs"
              >
                Publish to OpenUSD
              </Button>
            )}
          </div>
        </div>

        {/* Technical Stage Manifest */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-2">
            <span className="text-slate-400 font-bold block uppercase text-[11px]">Published Stage Root</span>
            <div className="flex items-center space-x-2 text-slate-200 break-all">
              <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>/shows/{version.project_code}/usd/master/{version.version_number}.usd</span>
            </div>
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
              DCC Tool: <span className="text-slate-300">{version.dcc_software || 'Solaris / USD'}</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-2">
            <span className="text-slate-400 font-bold block uppercase text-[11px]">Layer Composition Stack</span>
            <div className="space-y-1 text-slate-300 text-[11px]">
              {layers.map((layer, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <span className="text-slate-600">[{idx}]</span>
                  <span className="text-cyan-400">{layer}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Downstream Consumers Dependency Graph */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center space-x-2">
          <GitBranch className="w-4 h-4 text-purple-400" />
          <h4 className="text-xs font-mono font-bold text-slate-200 uppercase">
            Downstream Stage Dependencies
          </h4>
        </div>
        <p className="text-xs text-slate-400">
          When this version is published, the following downstream departments automatically receive payload references:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-xs font-mono font-bold text-slate-200">Editorial Conform</span>
            <p className="text-[11px] text-slate-400">OTIO sequence timeline synchronized.</p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-xs font-mono font-bold text-slate-200">Lighting & FX Pass</span>
            <p className="text-[11px] text-slate-400">USD sublayer reference linked to active shot.</p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-xs font-mono font-bold text-slate-200">Client Web Review</span>
            <p className="text-[11px] text-slate-400">H.264 proxy transcoded and watermarked.</p>
          </div>
        </div>
      </div>

      {/* Publish Modal */}
      <Modal isOpen={isPublishModalOpen} onClose={() => setIsPublishModalOpen(false)} title="Publish Version to Stage" size="md">
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Publishing will lock version <strong className="text-white">{version.version_number}</strong> and propagate its USD stage to downstream departments.
          </p>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">DCC Software Source</label>
            <input
              type="text"
              value={dccSoftware}
              onChange={(e) => setDccSoftware(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Changelog & Publish Comment</label>
            <textarea
              value={publishComment}
              onChange={(e) => setPublishComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handlePublish} isLoading={isPublishing}>
              Confirm OpenUSD Publish
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
