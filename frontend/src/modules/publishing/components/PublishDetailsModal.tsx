import React, { useState } from 'react';
import { PublishItem } from '@/types/publishing';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HardDrive,
  Copy,
  Terminal,
  Clock,
  Layers,
  FileCode,
  ShieldCheck,
  RotateCcw,
  Archive,
  RefreshCw,
} from 'lucide-react';

interface PublishDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PublishItem | null;
  onValidate: (id: string) => void;
  onRetry: (id: string) => void;
  onRepublish: (item: PublishItem) => void;
  onUnpublish: (item: PublishItem) => void;
}

export const PublishDetailsModal: React.FC<PublishDetailsModalProps> = ({
  isOpen,
  onClose,
  item,
  onValidate,
  onRetry,
  onRepublish,
  onUnpublish,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'validation' | 'manifest' | 'activity'>('overview');
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      id="publish-details-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={`Publish Inspector: ${item.publish_code}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Overview & Specs
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'validation'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Pre-flight QC Rules ({item.validation_rules?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('manifest')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'manifest'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            DCC Manifest & Hash
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Activity Stream ({item.activity?.length || 0})
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
                <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                  Target Entity & Artist
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Project:</span>
                    <span className="text-white font-medium">
                      {item.project_name} ({item.project_code})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Entity:</span>
                    <span className="text-white font-medium">
                      {item.entity_type} {item.entity_code} - {item.entity_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Department:</span>
                    <span className="text-indigo-300 font-medium">{item.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Version Number:</span>
                    <span className="text-emerald-400 font-mono font-bold">{item.version_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Artist:</span>
                    <span className="text-white">{item.artist_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">DCC Engine:</span>
                    <span className="text-amber-300 font-mono">
                      {item.dcc_software} {item.dcc_version || ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-3">
                <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  Media & Output Specifications
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Resolution:</span>
                    <span className="text-white font-mono">{item.resolution || '4096x2160'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Frame Range & FPS:</span>
                    <span className="text-white font-mono">
                      {item.frame_range || 'N/A'} @ {item.fps || 24} fps
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Color Space:</span>
                    <span className="text-emerald-300 font-mono">{item.color_space || 'ACEScg'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total File Size:</span>
                    <span className="text-white font-mono">{item.total_size_formatted || '4.5 GB'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Publish Destination:</span>
                    <span className="text-white font-medium">{item.destination.name}</span>
                    <span className="text-[11px] font-mono text-slate-400 block truncate">
                      {item.destination.path} ({item.destination.protocol})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Output File Path Card */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="truncate mr-3">
                <span className="text-slate-500 block text-[10px]">Published Storage Output Path:</span>
                <span className="text-indigo-300 select-all truncate block">{item.output_path}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(item.output_path)}
                className="shrink-0 text-xs"
              >
                <Copy className="w-3.5 h-3.5 mr-1" />
                {copied ? 'Copied' : 'Copy Path'}
              </Button>
            </div>

            {/* Comments & Summary */}
            {item.comment && (
              <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800/80 text-xs">
                <span className="text-slate-400 font-semibold block mb-1">Artist Publish Notes:</span>
                <p className="text-slate-200 leading-relaxed">{item.comment}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Validation */}
        {activeTab === 'validation' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <h4 className="text-xs font-semibold text-white">Pre-flight Validation Result</h4>
                <p className="text-[11px] text-slate-400">Automated Pyblish / OpenPype standard pre-flight rules</p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onValidate(item.id)}
                leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                className="text-xs bg-indigo-600 hover:bg-indigo-500"
              >
                Re-Run Validation
              </Button>
            </div>

            <div className="space-y-2">
              {item.validation_rules?.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 text-xs ${
                    rule.status === 'passed'
                      ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                      : rule.status === 'warning'
                      ? 'bg-amber-950/20 border-amber-500/20 text-amber-300'
                      : 'bg-rose-950/20 border-rose-500/20 text-rose-300'
                  }`}
                >
                  {rule.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                  {rule.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                  {rule.status === 'failed' && <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="font-semibold text-white">{rule.name}</strong>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {rule.category}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-0.5 leading-relaxed">{rule.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Manifest */}
        {activeTab === 'manifest' && (
          <div className="space-y-3">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  DCC Source File:
                </span>
                <span className="text-emerald-400">{item.dcc_file_path || 'Embedded Session'}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">SHA-256 Checksum:</span>
                <span className="text-indigo-300 select-all font-mono text-[11px] truncate max-w-sm">
                  {item.checksum_sha256 || '9f83a48e89fbc71c35b443328e9321c81ef4081c72019b88231c5fe8b417c801'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Published Timestamp:</span>
                <span className="text-slate-300">
                  {item.published_at ? new Date(item.published_at).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-400">
              <p>
                This publish item is indexed across the StudioHub production graph. It can be linked directly to
                screening playlists, review sessions, or packaged for client delivery turnovers.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Activity */}
        {activeTab === 'activity' && (
          <div className="space-y-2">
            {item.activity?.map((act) => (
              <div
                key={act.id}
                className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-start justify-between text-xs"
              >
                <div>
                  <h5 className="font-semibold text-white">{act.title}</h5>
                  <p className="text-slate-400 mt-0.5">{act.description}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">By {act.user_name}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {item.status !== 'Unpublished' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUnpublish(item)}
                className="text-xs text-slate-400 hover:text-rose-300 border-slate-800 hover:border-rose-500/30"
                leftIcon={<Archive className="w-3.5 h-3.5" />}
              >
                Unpublish
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {item.status === 'Failed' ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onRetry(item.id)}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-white"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Retry Publish
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onRepublish(item)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Republish Version
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
