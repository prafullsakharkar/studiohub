import React from 'react';
import {
  CalendarEvent,
  CalendarEventType,
  CalendarEventPriority,
  CalendarEventStatus,
} from '@/types/scheduling';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  Send,
  Flag,
  Film,
  PlayCircle,
  Cpu,
  Trash2,
  Edit,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { getEventTypeBadge, getPriorityBadge, formatEventDate, formatEventTime } from '../utils/calendarHelpers';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<CalendarEvent>) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
  onResolveConflict?: (event: CalendarEvent) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onUpdate,
  onDelete,
  onResolveConflict,
}) => {
  if (!event) return null;

  const badge = getEventTypeBadge(event.event_type);
  const priorityClass = getPriorityBadge(event.priority);

  const handleStatusChange = async (newStatus: CalendarEventStatus) => {
    await onUpdate(event.id, { status: newStatus });
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to remove "${event.title}" from the studio schedule?`)) {
      await onDelete(event.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border} flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                {badge.label}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityClass}`}>
                {event.priority} Priority
              </span>
              {event.project_code && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  {event.project_code}
                </span>
              )}
              {event.is_overbooked && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Overbooked Conflict
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">{event.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-sm">
          {/* Overbooking Alert Banner if conflicted */}
          {event.is_overbooked && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-300">Schedule Overlap / Capacity Breach</p>
                <p className="text-xs text-red-200/80 leading-relaxed">
                  {event.overbooking_details?.message ||
                    'This event exceeds standard weekly artist working hours or conflicts with concurrent equipment bookings.'}
                </p>
              </div>
            </div>
          )}

          {/* Schedule Timing & Location Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                Schedule Dates
              </div>
              <p className="text-slate-200 font-medium">
                {formatEventDate(event.start_date)}
                {event.start_date.split('T')[0] !== event.end_date.split('T')[0] && ` → ${formatEventDate(event.end_date)}`}
              </p>
              {!event.all_day && (
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  {formatEventTime(event.start_date)} - {formatEventTime(event.end_date)}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                Office & Studio Bay
              </div>
              <p className="text-slate-200 font-medium">{event.office_name || 'All Studios'}</p>
              {event.location_or_link && (
                <p className="text-xs text-slate-400 truncate">{event.location_or_link}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Description / Scope</h4>
              <p className="text-slate-300 bg-slate-950/30 p-3.5 rounded-xl border border-slate-800/60 text-sm leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Connected Production Entities */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Production Linking</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {event.project_name && (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <Film className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Project</p>
                    <p className="text-sm font-semibold text-slate-200 truncate">{event.project_name}</p>
                  </div>
                </div>
              )}

              {event.task_code && (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Linked Task</p>
                    <p className="text-sm font-semibold text-slate-200 truncate">{event.task_code}</p>
                  </div>
                </div>
              )}

              {event.department && (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Department</p>
                    <p className="text-sm font-semibold text-slate-200 truncate">{event.department}</p>
                  </div>
                </div>
              )}

              {event.equipment_names && event.equipment_names.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Equipment / Suite</p>
                    <p className="text-sm font-semibold text-slate-200 truncate">{event.equipment_names.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Crew */}
          {event.assignee_names && event.assignee_names.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Allocated Crew</h4>
              <div className="flex flex-wrap gap-2">
                {event.assignee_names.map((name, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-200 text-xs font-medium"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {name.charAt(0)}
                    </div>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies / Critical Path */}
          {event.dependencies && (
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pipeline Dependencies</span>
                {event.dependencies.is_critical_path && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                    Critical Path Gate
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-4">
                <span>Upstream Predecessors: {event.dependencies.upstream_event_ids?.length || 0}</span>
                <span>Downstream Dependents: {event.dependencies.downstream_event_ids?.length || 0}</span>
              </div>
            </div>
          )}

          {/* Status Quick Switch */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Production Status</h4>
            <div className="flex flex-wrap gap-2">
              {(['Scheduled', 'In Progress', 'Completed', 'Pending Review', 'At Risk'] as CalendarEventStatus[]).map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      event.status === st
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/60 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Event
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
