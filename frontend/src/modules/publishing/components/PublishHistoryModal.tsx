import React from 'react';
import { PublishItem } from '@/types/publishing';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { History, CheckCircle2, Clock, Terminal, HardDrive } from 'lucide-react';

interface PublishHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PublishItem | null;
}

export const PublishHistoryModal: React.FC<PublishHistoryModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  if (!item) return null;

  return (
    <Modal
      id="publish-history-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={`Publish Revision History: ${item.entity_code}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400">Current Hero Pointer:</span>
            <span className="text-emerald-400 font-mono font-bold ml-2">{item.version_number}</span>
          </div>
          <div className="text-slate-400 font-mono">Total Revisions: {item.history?.length || 1}</div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {item.history && item.history.length > 0 ? (
            item.history.map((snap) => (
              <div
                key={snap.id}
                className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
                      Revision #{snap.revision_number}
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">{snap.version_number}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {snap.dcc_software}
                    </span>
                  </div>

                  <span className="text-slate-500 font-mono text-[11px]">
                    {new Date(snap.published_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed italic">"{snap.change_reason}"</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 font-mono text-[11px] text-slate-400">
                  <div className="truncate">
                    <span className="text-slate-500">Output:</span>{' '}
                    <span className="text-slate-300 truncate">{snap.output_path}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">Hash:</span>{' '}
                    <span className="text-indigo-300 truncate">{snap.checksum_sha256}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Author: {snap.artist_name}</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Snapshot Archived
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              No historical revision snapshots recorded yet.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
