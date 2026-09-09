import React, { useState } from 'react';
import {
  CalendarEventType,
  CalendarEventPriority,
  CalendarEventStatus,
  CalendarEvent,
  Resource,
} from '@/types/scheduling';
import {
  X,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Film,
  Users,
  CheckCircle2,
  Cpu,
  Layers,
  Flag,
  PlayCircle,
  Send,
} from 'lucide-react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: Partial<CalendarEvent>) => Promise<any>;
  resources: Resource[];
  initialDate?: Date;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  resources,
  initialDate,
}) => {
  const defaultDateStr = (initialDate || new Date(2026, 7, 26)).toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('task');
  const [startDate, setStartDate] = useState(defaultDateStr);
  const [endDate, setEndDate] = useState(defaultDateStr);
  const [allDay, setAllDay] = useState(true);
  const [priority, setPriority] = useState<CalendarEventPriority>('High');
  const [projectCode, setProjectCode] = useState('NK99');
  const [department, setDepartment] = useState('Compositing');
  const [officeName, setOfficeName] = useState('Montreal HQ');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const peopleResources = resources.filter((r) => r.type === 'person');
  const equipmentResources = resources.filter((r) => r.type === 'equipment');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the event.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const assignedPerson = peopleResources.find((p) => p.id === selectedAssigneeId);
      const assignedEquipment = equipmentResources.find((eq) => eq.id === selectedEquipmentId);

      const projectNames: Record<string, string> = {
        NK99: 'Blade Runner 2099: Cyberpunk City',
        DUNE: 'Dune: Prophecy Awakening',
        CP88: 'Cyberpunk 2088: Netrunner Requiem',
        AVTR: 'Avatar: Ocean Depths VFX',
      };

      await onSubmit({
        title,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate,
        all_day: allDay,
        priority,
        status: 'Scheduled',
        project_code: projectCode !== 'NONE' ? projectCode : undefined,
        project_name: projectCode !== 'NONE' ? projectNames[projectCode] : undefined,
        department,
        office_name: officeName,
        primary_assignee_id: assignedPerson?.id,
        primary_assignee_name: assignedPerson?.name,
        primary_assignee_avatar: assignedPerson?.avatar_url,
        assignee_ids: assignedPerson ? [assignedPerson.id] : [],
        assignee_names: assignedPerson ? [assignedPerson.name] : [],
        equipment_ids: assignedEquipment ? [assignedEquipment.id] : [],
        equipment_names: assignedEquipment ? [assignedEquipment.name] : [],
        location_or_link: locationOrLink || undefined,
        description,
        progress_pct: 0,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create schedule event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Add Production Schedule Event</h2>
              <p className="text-xs text-slate-400">Schedule tasks, milestones, dailies reviews, deliveries & crew shifts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Event Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Event Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Shot NK99_020_040 Final Comp Review"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-600 text-sm font-medium"
            />
          </div>

          {/* Event Type Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Event Classification
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { id: 'task', label: 'Task', icon: CheckCircle2, color: 'text-indigo-400' },
                { id: 'milestone', label: 'Milestone', icon: Flag, color: 'text-pink-400' },
                { id: 'review', label: 'Review / Dailies', icon: PlayCircle, color: 'text-cyan-400' },
                { id: 'delivery', label: 'Delivery', icon: Send, color: 'text-emerald-400' },
                { id: 'project', label: 'Project Phase', icon: Film, color: 'text-rose-400' },
                { id: 'meeting', label: 'Meeting', icon: Users, color: 'text-purple-400' },
                { id: 'leave', label: 'Artist Leave', icon: Calendar, color: 'text-slate-400' },
                { id: 'holiday', label: 'Holiday', icon: MapPin, color: 'text-amber-400' },
                { id: 'availability', label: 'Free Capacity', icon: Cpu, color: 'text-green-400' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = eventType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEventType(item.id as CalendarEventType)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/80 text-indigo-200 shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : item.color}`} />
                    <span className="text-[11px] truncate w-full text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs font-mono"
              />
            </div>
          </div>

          {/* Project & Department Linking */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Project Code
              </label>
              <select
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="NONE">-- No Project (Studio Wide) --</option>
                <option value="NK99">NK99 (Blade Runner 2099)</option>
                <option value="DUNE">DUNE (Dune Awakening)</option>
                <option value="CP88">CP88 (Cyberpunk 2088)</option>
                <option value="AVTR">AVTR (Avatar Ocean Deep)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="VFX Supervision">VFX Supervision</option>
                <option value="Compositing">Compositing</option>
                <option value="FX Simulation">FX Simulation</option>
                <option value="Matchmove & Tracking">Matchmove & Tracking</option>
                <option value="Character Animation">Character Animation</option>
                <option value="Lighting & LookDev">Lighting & LookDev</option>
                <option value="Pipeline">Pipeline & Core</option>
                <option value="Production">Production Management</option>
                <option value="Editorial & Delivery">Editorial & Delivery</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CalendarEventPriority)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs font-semibold"
              >
                <option value="Critical">Critical (Blocker)</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Assignee & Equipment Allocations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Key Assignee / Artist
              </label>
              <select
                value={selectedAssigneeId}
                onChange={(e) => setSelectedAssigneeId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="">-- Select Person (Optional) --</option>
                {peopleResources.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role} - {p.department_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Dedicated Suite / Equipment
              </label>
              <select
                value={selectedEquipmentId}
                onChange={(e) => setSelectedEquipmentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
              >
                <option value="">-- No Dedicated Suite Booked --</option>
                {equipmentResources.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.office_name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location / Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Location / Room / Virtual Link
            </label>
            <input
              type="text"
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              placeholder="e.g., Montreal Screening Bay A / SyncSketch Reel #44"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Notes & Deliverables
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, required software passes, or delivery parameters..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 -mx-6 -mb-6 flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              {submitting ? 'Scheduling...' : 'Save & Schedule Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
