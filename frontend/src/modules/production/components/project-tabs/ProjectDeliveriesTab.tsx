import React, { useState } from 'react';
import {
  PackageCheck,
  Download,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCode,
  HardDrive,
  Send,
  Plus,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { Project } from '@/types/projects';
import {
  mockProjectDeliverables,
  ProjectDeliverableItem,
} from '@/mocks/db/production/projectDetails';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectDeliveriesTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectDeliveriesTab: React.FC<ProjectDeliveriesTabProps> = ({ project }) => {
  const [deliverables, setDeliverables] = useState<ProjectDeliverableItem[]>(
    mockProjectDeliverables.filter((d) => d.project_id === project.id).length > 0
      ? mockProjectDeliverables.filter((d) => d.project_id === project.id)
      : mockProjectDeliverables
  );
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);

  const addNotification = useNotificationStore((state) => state.addNotification);

  const [formData, setFormData] = useState({
    package_name: `${project.code}_DELIVERY_PACKAGE_v01.tar.gz`,
    format: '16-bit Half-Float OpenEXR ZIP',
    resolution: project.resolution || '4096x2160',
    audio_config: '5.1 Master Stems',
    color_space: project.color_space || 'ACEScg',
    frame_count: 2400,
    file_size_gb: 120.0,
    delivery_target: 'Aspera Client Portal',
    recipient: project.client_contact_name || 'Client VFX Editorial Board',
  });

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const newDel: ProjectDeliverableItem = {
      id: `pdel-${Date.now()}`,
      project_id: project.id,
      ...formData,
      status: 'Delivered',
      checksum_sha256: '4f53cda18c2b87f9012384910cf9182374901823740912387409128374091823',
      delivered_at: new Date().toISOString(),
    };
    setDeliverables([newDel, ...deliverables]);
    setIsDispatchOpen(false);
    addNotification({
      type: 'success',
      title: 'Deliverable Package Dispatched',
      message: `Package ${formData.package_name} securely transmitted to ${formData.delivery_target}.`,
    });
  };

  const copyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    addNotification({
      type: 'info',
      title: 'SHA-256 Checksum Copied',
      message: checksum,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-indigo-400" />
            Master Deliverables & Client Transmittals Manifest
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Compliant with MPAA/CDSA Tier 4 security standards & Aspera/Signiant high-speed gateway
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsDispatchOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Dispatch Package
        </Button>
      </div>

      {/* Deliverables List */}
      <div className="space-y-4">
        {deliverables.map((del) => (
          <div
            key={del.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-mono">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-mono">{del.package_name}</h4>
                  <p className="text-xs text-slate-400">{del.delivery_target} • Recipient: {del.recipient}</p>
                </div>
              </div>

              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded self-start sm:self-auto ${
                  del.status === 'Delivered' || del.status === 'Approved'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                }`}
              >
                ● {del.status}
              </span>
            </div>

            {/* Technical Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase block">Format</span>
                <span className="font-bold text-white block truncate">{del.format}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase block">Resolution & Color</span>
                <span className="font-bold text-indigo-400 block truncate">{del.resolution} • {del.color_space}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase block">Payload Size</span>
                <span className="font-bold text-white block">{del.file_size_gb} GB ({del.frame_count} frames)</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase block">Audio Track</span>
                <span className="font-bold text-slate-300 block truncate">{del.audio_config}</span>
              </div>
            </div>

            {/* Checksum & Time */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-500">SHA-256:</span>
                <span className="text-slate-300 truncate max-w-xs">{del.checksum_sha256}</span>
                <button
                  onClick={() => copyChecksum(del.checksum_sha256)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="Copy SHA-256 Checksum"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <span>{del.delivered_at ? new Date(del.delivered_at).toLocaleString() : 'Pending Transmission'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Dispatch Modal */}
      <Modal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        title="Dispatch Master Deliverable Package"
        subtitle={`Generate package for show ${project.name} (${project.code})`}
      >
        <form onSubmit={handleDispatch} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Package Tarball / Zip Name</label>
            <input
              required
              type="text"
              value={formData.package_name}
              onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Format</label>
              <input
                type="text"
                value={formData.format}
                onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Delivery Gateway</label>
              <input
                type="text"
                value={formData.delivery_target}
                onChange={(e) => setFormData({ ...formData, delivery_target: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Estimated Size (GB)</label>
              <input
                type="number"
                value={formData.file_size_gb}
                onChange={(e) => setFormData({ ...formData, file_size_gb: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Recipient Contact</label>
              <input
                type="text"
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsDispatchOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Transmit Package
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
