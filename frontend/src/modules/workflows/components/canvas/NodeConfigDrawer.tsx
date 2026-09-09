import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Clock,
  Shield,
  Layers,
  Sparkles,
  Zap,
  CheckCircle,
  FileCode,
  Sliders,
  Play,
  Send,
  UploadCloud,
} from 'lucide-react';
import { WorkflowNode, WorkflowNodeType } from '@/types/workflow';
import { Button } from '@/shared/components/Button';

interface NodeConfigDrawerProps {
  node: WorkflowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedNode: WorkflowNode) => void;
}

const departments = [
  'Editorial',
  'Concept Art',
  'Modeling',
  'Texturing & LookDev',
  'Rigging / Layout',
  'Animation',
  'FX & Simulation',
  'Lighting',
  'Compositing',
  'Pipeline TD',
  'Production',
];

const dccSoftwares = [
  'Autodesk Maya',
  'SideFX Houdini',
  'NukeX 15.0',
  '3DEqualizer 4',
  'ZBrush',
  'Substance Painter / Designer',
  'Houdini Solaris / Karma XPU',
  'DaVinci Resolve Studio',
  'OpenUSD CLI Tools',
  'Custom Python Pipeline',
];

export const NodeConfigDrawer: React.FC<NodeConfigDrawerProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<WorkflowNode | null>(null);

  useEffect(() => {
    if (node) {
      setFormData(JSON.parse(JSON.stringify(node)));
    }
  }, [node]);

  if (!isOpen || !formData) return null;

  const handleFieldChange = (field: keyof WorkflowNode, value: any) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleConfigChange = (field: string, value: any) => {
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        config: {
          ...prev.config,
          [field]: value,
        },
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
            Node Configuration
          </span>
          <h3 className="text-sm font-bold text-white truncate">{formData.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Title */}
        <div>
          <label className="block text-slate-400 font-mono text-[11px] mb-1">NODE TITLE</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-medium focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-slate-400 font-mono text-[11px] mb-1">DESCRIPTION</label>
          <textarea
            rows={2}
            value={formData.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-normal focus:border-indigo-500 focus:outline-none resize-none"
            placeholder="Document step intent and contracts..."
          />
        </div>

        {/* Department & DCC (For Task & Review nodes) */}
        {(formData.type === 'task' || formData.type === 'start' || formData.type === 'review') && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                DEPARTMENT RESPONSIBLE
              </label>
              <select
                value={formData.department || departments[0]}
                onChange={(e) => {
                  handleFieldChange('department', e.target.value);
                  handleConfigChange('department', e.target.value);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                PRIMARY DCC SOFTWARE
              </label>
              <select
                value={formData.config.primary_dcc || dccSoftwares[0]}
                onChange={(e) => {
                  handleFieldChange('primary_dcc', e.target.value);
                  handleConfigChange('primary_dcc', e.target.value);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                {dccSoftwares.map((sw) => (
                  <option key={sw} value={sw}>
                    {sw}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                SLA TURNAROUND BUDGET (HOURS)
              </label>
              <input
                type="number"
                min="1"
                max="240"
                value={formData.config.sla_hours || 16}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 16;
                  handleFieldChange('sla_hours', val);
                  handleConfigChange('sla_hours', val);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Approval Specific Controls */}
        {formData.type === 'approval' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                GATEKEEPER ROLE
              </label>
              <select
                value={formData.config.approval_type || 'supervisor'}
                onChange={(e) => handleConfigChange('approval_type', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="supervisor">VFX Supervisor Signoff</option>
                <option value="lead">Department Lead Check</option>
                <option value="director">Animation / Film Director</option>
                <option value="client">Client Executive Producer</option>
              </select>
            </div>
          </div>
        )}

        {/* Publish Specific Controls */}
        {formData.type === 'publish' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                PUBLISH TARGET CATALOG
              </label>
              <select
                value={formData.config.publish_target || 'comp_exr'}
                onChange={(e) => handleConfigChange('publish_target', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="comp_exr">ACEScg Final 4K EXR Master</option>
                <option value="hero_asset">OpenUSD Master Asset Layer (@asset.usd@)</option>
                <option value="usd_layer">Sub-Layer Geometry / Shaders</option>
                <option value="plate_ingest">Editorial Plates Ingest</option>
              </select>
            </div>
          </div>
        )}

        {/* Delivery Specific Controls */}
        {formData.type === 'delivery' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                TURNOVER TRANSMISSION PROTOCOL
              </label>
              <select
                value={formData.config.delivery_protocol || 'aspera'}
                onChange={(e) => handleConfigChange('delivery_protocol', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="aspera">IBM Aspera High-Speed FASP</option>
                <option value="signiant">Signiant Media Shuttle</option>
                <option value="s3">AWS S3 Glacier Vault</option>
                <option value="internal_san">Studio Internal Fiber SAN</option>
              </select>
            </div>
          </div>
        )}

        {/* Condition Specific Controls */}
        {formData.type === 'condition' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                EVALUATION FIELD
              </label>
              <input
                type="text"
                value={formData.config.condition_field || 'status'}
                onChange={(e) => handleConfigChange('condition_field', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
                placeholder="e.g. status, validation_score, is_approved"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                OPERATOR
              </label>
              <select
                value={formData.config.condition_operator || 'equals'}
                onChange={(e) => handleConfigChange('condition_operator', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="equals">Equals (==)</option>
                <option value="not_equals">Not Equals (!=)</option>
                <option value="greater_than">Greater Than (&gt;)</option>
                <option value="less_than">Less Than (&lt;)</option>
                <option value="contains">Contains</option>
                <option value="all_passed">All Dependencies Met</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                TARGET VALUE
              </label>
              <input
                type="text"
                value={formData.config.condition_value || 'Approved'}
                onChange={(e) => handleConfigChange('condition_value', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
                placeholder="Target value or threshold"
              />
            </div>
          </div>
        )}

        {/* Automation Specific Controls */}
        {formData.type === 'automation' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                TRIGGER ACTION
              </label>
              <select
                value={formData.config.automation_action || 'publish_version'}
                onChange={(e) => handleConfigChange('automation_action', e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:border-indigo-500 focus:outline-none"
              >
                <option value="publish_version">Publish Version to Master</option>
                <option value="notify_producer">Notify VFX Producer & Leads</option>
                <option value="create_delivery">Assemble Client Delivery</option>
                <option value="update_project_status">Advance Milestone Status</option>
                <option value="dispatch_render_farm">Dispatch Farm Turntable Render</option>
                <option value="create_review_session">Add to Screening Room Playlist</option>
              </select>
            </div>
          </div>
        )}

        {/* Position coordinates */}
        <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
          <div>X Position: {Math.round(formData.position.x)}px</div>
          <div>Y Position: {Math.round(formData.position.y)}px</div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Apply Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
