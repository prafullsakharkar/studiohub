import React, { useState } from 'react';
import { DeliveryVersionRef } from '@/types/deliveries';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Plus, Film, Box, Check } from 'lucide-react';

interface AddVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVersion: (version: DeliveryVersionRef) => Promise<any>;
}

const availableShotOptions: DeliveryVersionRef[] = [
  {
    id: 'shot-opt-1',
    entity_type: 'Shot',
    entity_code: 'SH060',
    version_number: 'v004',
    department: 'Compositing',
    artist_name: 'Sarah Jenkins',
    resolution: '4096x2160 (DCI 4K)',
    fps: 24,
    frame_range: '1001-1150',
    duration_frames: 150,
    duration_tc: '00:00:06:06',
    file_format: 'EXR 16-bit float',
    file_size_bytes: 5368709120,
    file_size_formatted: '5.00 GB',
    checksum_sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    color_space: 'ACEScg (AP1 / Linear)',
    thumbnail_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400',
    status: 'Ready',
    is_hero: true,
    notes_count: 0,
  },
  {
    id: 'shot-opt-2',
    entity_type: 'Shot',
    entity_code: 'SH075',
    version_number: 'v002',
    department: 'Lighting & LookDev',
    artist_name: 'Kenji Sato',
    resolution: '4096x2160 (DCI 4K)',
    fps: 24,
    frame_range: '1001-1120',
    duration_frames: 120,
    duration_tc: '00:00:05:00',
    file_format: 'ProRes 4444 XQ',
    file_size_bytes: 4294967296,
    file_size_formatted: '4.00 GB',
    checksum_sha256: 'b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef01',
    color_space: 'ACEScc Rec.709 Slate',
    thumbnail_url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400',
    status: 'Ready',
    is_hero: true,
    notes_count: 1,
  },
  {
    id: 'shot-opt-3',
    entity_type: 'Asset',
    entity_code: 'AST-HOVER-MECH',
    version_number: 'v005',
    department: '3D Modeling & Assets',
    artist_name: 'Elena Rostova',
    resolution: 'OpenUSD Stage 2.2',
    fps: 24,
    frame_range: 'N/A',
    duration_frames: 1,
    duration_tc: '00:00:00:01',
    file_format: 'USD Stage Package',
    file_size_bytes: 1073741824,
    file_size_formatted: '1.00 GB',
    checksum_sha256: 'c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef012',
    color_space: 'ACEScg Textures',
    thumbnail_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
    status: 'Ready',
    is_hero: true,
    notes_count: 2,
  },
];

export const AddVersionModal: React.FC<AddVersionModalProps> = ({
  isOpen,
  onClose,
  onAddVersion,
}) => {
  const [selectedId, setSelectedId] = useState<string>(availableShotOptions[0].id);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = availableShotOptions.find((o) => o.id === selectedId);
    if (!item) return;

    setSubmitting(true);
    try {
      await onAddVersion({
        ...item,
        id: `del-v-${Date.now()}`,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="add-version-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Add Published Version to Delivery Package"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400">
          Select an approved published version from the project repository to append to this delivery payload:
        </p>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {availableShotOptions.map((opt) => (
            <div
              key={opt.id}
              onClick={() => setSelectedId(opt.id)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedId === opt.id
                  ? 'bg-indigo-950/40 border-indigo-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={opt.thumbnail_url}
                  alt={opt.entity_code}
                  className="w-12 h-10 object-cover rounded-lg border border-slate-800"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white flex items-center gap-1">
                      {opt.entity_type === 'Shot' ? <Film className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
                      {opt.entity_code}
                    </span>
                    <span className="font-mono text-emerald-400 text-xs font-bold">{opt.version_number}</span>
                    <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {opt.department}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {opt.file_format} • {opt.file_size_formatted} • {opt.frame_range}
                  </div>
                </div>
              </div>

              {selectedId === opt.id && (
                <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={submitting}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            {submitting ? 'Adding...' : 'Add Version to Payload'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
