import React, { useState } from 'react';
import { ProductionVersion } from '@/types/versions';
import { ProductionStatus } from '@/types/common';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';

interface VersionEditModalProps {
  version: ProductionVersion;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProductionVersion>) => Promise<any>;
}

export const VersionEditModal: React.FC<VersionEditModalProps> = ({
  version,
  isOpen,
  onClose,
  onSave,
}) => {
  const [code, setCode] = useState(version.code);
  const [versionNumber, setVersionNumber] = useState(version.version_number);
  const [status, setStatus] = useState<ProductionStatus>(version.status);
  const [description, setDescription] = useState(version.description || '');
  const [colorSpace, setColorSpace] = useState(version.color_space || 'ACEScg');
  const [resolution, setResolution] = useState(version.resolution || '4096x2160');
  const [dccSoftware, setDccSoftware] = useState(version.dcc_software || 'NukeX 15.0v2');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave({
        code,
        version_number: versionNumber,
        status,
        description,
        color_space: colorSpace,
        resolution,
        dcc_software: dccSoftware,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Version: ${version.version_number}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Version Number</label>
            <input
              type="text"
              required
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Version Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Production Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductionStatus)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="in_progress">In Progress</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="approved">Approved</option>
              <option value="changes_requested">Changes Requested (Retake)</option>
              <option value="final_approved">Final Approved</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Color Space</label>
            <select
              value={colorSpace}
              onChange={(e) => setColorSpace(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ACEScg">ACEScg (ACES 1.3)</option>
              <option value="ACEScc">ACEScc</option>
              <option value="Rec.709">Rec.709 Linear</option>
              <option value="LogC4">ARRI LogC4</option>
              <option value="sRGB">sRGB Display</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Resolution</label>
            <input
              type="text"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">DCC Software</label>
            <input
              type="text"
              value={dccSoftware}
              onChange={(e) => setDccSoftware(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">Revision Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
