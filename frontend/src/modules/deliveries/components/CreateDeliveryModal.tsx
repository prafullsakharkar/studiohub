import React, { useState } from 'react';
import { DeliveryPackage, DeliveryDestination } from '@/types/deliveries';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Send, Building, HardDrive, Calendar, Layers } from 'lucide-react';

interface CreateDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  destinations: DeliveryDestination[];
  onCreate: (data: Partial<DeliveryPackage>) => Promise<DeliveryPackage>;
}

export const CreateDeliveryModal: React.FC<CreateDeliveryModalProps> = ({
  isOpen,
  onClose,
  destinations,
  onCreate,
}) => {
  const [projectCode, setProjectCode] = useState('NK99');
  const [projectName, setProjectName] = useState('Neo Kyoto 2099');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('Warner Bros. Discovery & Media');
  const [clientRep, setClientRep] = useState('Michael Sterling (Post Exec)');
  const [clientEmail, setClientEmail] = useState('m.sterling@warnerbros.com');
  const [destinationId, setDestinationId] = useState(destinations[0]?.id || 'dest-del-001');
  const [dueDate, setDueDate] = useState('2026-08-30');
  const [milestoneName, setMilestoneName] = useState('Trailer Picture Lock Delivery');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedDest = destinations.find((d) => d.id === destinationId) || destinations[0];
      await onCreate({
        project_code: projectCode,
        project_name: projectName,
        title,
        description,
        milestone_name: milestoneName,
        due_date: new Date(dueDate).toISOString(),
        destination: selectedDest,
        client: {
          id: `cli-${Date.now()}`,
          code: clientName.includes('Warner') ? 'WARNER-MEDIA' : 'HBO-MAX',
          name: clientName,
          representative_name: clientRep,
          contact_email: clientEmail,
          auto_notify: true,
        },
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="create-delivery-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Create Studio Delivery Turnover Package"
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Milestone Name</label>
            <input
              type="text"
              value={milestoneName}
              onChange={(e) => setMilestoneName(e.target.value)}
              placeholder="e.g. Episode 101 Picture Lock"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Package Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Neo Kyoto 2099 - Teaser Trailer Master Turnover (4K EXR + ProRes)"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Package Overview & Delivery Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Specify delivered color spaces, ACES linear flags, slate burn-ins, and audio stems..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            required
          />
        </div>

        {/* Client Details Section */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5" /> Client Stakeholder & Recipient
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Client Entity</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Representative Name</label>
              <input
                type="text"
                value={clientRep}
                onChange={(e) => setClientRep(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Contact Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Ingest Destination</label>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Turnover Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
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
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            {submitting ? 'Creating Package...' : 'Initialize Delivery'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
