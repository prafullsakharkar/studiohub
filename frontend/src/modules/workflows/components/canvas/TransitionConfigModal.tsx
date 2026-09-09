import React, { useState, useEffect } from 'react';
import { X, GitBranch, ArrowRight, Save, Trash2 } from 'lucide-react';
import { WorkflowTransition, TransitionTriggerEvent } from '@/types/workflow';
import { Button } from '@/shared/components/Button';

interface TransitionConfigModalProps {
  transition: WorkflowTransition | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: WorkflowTransition) => void;
  onDelete: (id: string) => void;
}

const triggerEvents: Array<{ id: TransitionTriggerEvent; label: string }> = [
  { id: 'status_changed', label: 'Status Changed (e.g. In Progress -> Complete)' },
  { id: 'approved', label: 'Supervisor Signoff / Review Approved' },
  { id: 'rejected', label: 'Changes Requested / Retake' },
  { id: 'qc_passed', label: 'Pyblish Automated QC Passed' },
  { id: 'qc_failed', label: 'QC Failed / Geometry Error' },
  { id: 'published', label: 'Artifact Published to USD Catalog' },
  { id: 'delivered', label: 'Client Delivery Dispatched' },
  { id: 'sla_breached', label: 'SLA Budget Warning / Breached' },
  { id: 'manual', label: 'Manual Stage Advancement' },
];

export const TransitionConfigModal: React.FC<TransitionConfigModalProps> = ({
  transition,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<WorkflowTransition | null>(null);

  useEffect(() => {
    if (transition) {
      setFormData(JSON.parse(JSON.stringify(transition)));
    }
  }, [transition]);

  if (!isOpen || !formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Transition & Edge Trigger</h3>
              <p className="text-[11px] font-mono text-slate-400">
                {formData.source_node_id} <ArrowRight className="inline w-3 h-3 mx-1" /> {formData.target_node_id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              EDGE LABEL / DESCRIPTION
            </label>
            <input
              type="text"
              value={formData.label || ''}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Plates QC Passed, 3D Camera Approved"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              TRIGGER EVENT
            </label>
            <select
              value={formData.trigger_event || 'status_changed'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  trigger_event: e.target.value as TransitionTriggerEvent,
                })
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
            >
              {triggerEvents.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Expression */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-[11px] font-mono font-bold text-amber-400 block uppercase">
              Conditional Evaluation (Optional)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Field</label>
                <input
                  type="text"
                  value={formData.condition?.field || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: {
                        field: e.target.value,
                        operator: formData.condition?.operator || '==',
                        value: formData.condition?.value || '',
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white font-mono"
                  placeholder="verdict"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Operator</label>
                <select
                  value={formData.condition?.operator || '=='}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: {
                        field: formData.condition?.field || '',
                        operator: e.target.value as any,
                        value: formData.condition?.value || '',
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white font-mono"
                >
                  <option value="==">== Equals</option>
                  <option value="!=">!= Not Equals</option>
                  <option value=">=">&gt;= Greater</option>
                  <option value="passed">passed (QC)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-1">Value</label>
                <input
                  type="text"
                  value={formData.condition?.value || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: {
                        field: formData.condition?.field || '',
                        operator: formData.condition?.operator || '==',
                        value: e.target.value,
                      },
                    })
                  }
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-white font-mono"
                  placeholder="Approved"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onDelete(formData.id);
                onClose();
              }}
              className="text-rose-400 hover:text-rose-300 font-mono text-xs flex items-center gap-1 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Transition
            </button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="gap-1.5">
                <Save className="w-3.5 h-3.5" />
                Save Edge
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
