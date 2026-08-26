import React, { useState } from 'react';
import { useScheduling } from '../hooks/useScheduling';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { CalendarTimelineView } from './CalendarTimelineView';
import { ResourceGridView } from './ResourceGridView';
import { ResourceCapacityView } from './ResourceCapacityView';
import { ResourceUtilizationView } from './ResourceUtilizationView';
import { ResourceAssignmentsView } from './ResourceAssignmentsView';
import { EventDetailModal } from './EventDetailModal';
import { CreateEventModal } from './CreateEventModal';
import { OverbookingAlertDrawer } from './OverbookingAlertDrawer';
import { CalendarEvent, Resource } from '@/types/scheduling';
import {
  Calendar,
  Clock,
  Users,
  Film,
  Cpu,
  ShieldAlert,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  BarChart3,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export type SchedulingPrimaryView =
  | 'month'
  | 'week'
  | 'day'
  | 'timeline'
  | 'resources'
  | 'capacity'
  | 'utilization'
  | 'assignments';

export const SchedulingWorkspace: React.FC = () => {
  const {
    filteredEvents,
    resources,
    filteredResources,
    capacitySummaries,
    overbookingAlerts,
    holidays,
    leaves,
    loading,
    error,
    currentDate,
    setCurrentDate,
    filters,
    setFilters,
    createEvent,
    updateEvent,
    deleteEvent,
    resolveOverbooking,
  } = useScheduling();

  const [activeView, setActiveView] = useState<SchedulingPrimaryView>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOverbookingDrawerOpen, setIsOverbookingDrawerOpen] = useState(false);
  const [initialCreateDate, setInitialCreateDate] = useState<Date | undefined>(undefined);

  // Date navigation handlers
  const handlePrevDate = () => {
    const next = new Date(currentDate);
    if (activeView === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (activeView === 'week' || activeView === 'timeline') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNextDate = () => {
    const next = new Date(currentDate);
    if (activeView === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (activeView === 'week' || activeView === 'timeline') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 7, 26)); // Production reference date
  };

  const handleOpenAddEventOnDate = (date: Date) => {
    setInitialCreateDate(date);
    setIsCreateModalOpen(true);
  };

  const formattedCurrentDateHeader = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Application Subheader */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md">
        {/* Left: Module Title & Date Nav */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-600/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Production Scheduling & Resources
              </h1>
              <p className="text-xs text-slate-400">
                Dense calendar, capacity forecasting, task dependencies & conflict resolution
              </p>
            </div>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={handleToday}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Today
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <button
              onClick={handlePrevDate}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-bold font-mono text-slate-200 min-w-[130px] text-center">
              {formattedCurrentDateHeader}
            </span>
            <button
              onClick={handleNextDate}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Overbooking Warning & Action Button */}
        <div className="flex items-center gap-3">
          {overbookingAlerts.length > 0 && (
            <button
              onClick={() => setIsOverbookingDrawerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-800/80 hover:bg-red-900/60 text-red-200 text-xs font-bold shadow-md shadow-red-950/40 transition-all flex items-center gap-2 animate-pulse"
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{overbookingAlerts.length} Overbooking Conflicts</span>
            </button>
          )}

          <button
            onClick={() => {
              setInitialCreateDate(currentDate);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Event</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs Bar */}
      <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Calendar vs Resource Views */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {/* Calendar Views Group */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            {(
              [
                { id: 'month', label: 'Month' },
                { id: 'week', label: 'Week' },
                { id: 'day', label: 'Day' },
                { id: 'timeline', label: 'Timeline / Gantt' },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeView === v.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-800" />

          {/* Resource Views Group */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            {(
              [
                { id: 'resources', label: 'Resource Grid' },
                { id: 'capacity', label: 'Capacity' },
                { id: 'utilization', label: 'Utilization' },
                { id: 'assignments', label: 'Assignments' },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeView === v.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dense Filters Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search schedule..."
              className="pl-8 pr-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 w-44 placeholder-slate-600 font-medium"
            />
          </div>

          {/* Project Filter */}
          <select
            value={filters.projectCode}
            onChange={(e) => setFilters({ ...filters, projectCode: e.target.value })}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono font-medium"
          >
            <option value="ALL">All Projects</option>
            <option value="NK99">NK99</option>
            <option value="DUNE">DUNE</option>
            <option value="CP88">CP88</option>
            <option value="AVTR">AVTR</option>
          </select>

          {/* Event Type Filter */}
          <select
            value={filters.eventType}
            onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="ALL">All Event Types</option>
            <option value="task">Tasks</option>
            <option value="milestone">Milestones</option>
            <option value="review">Reviews / Dailies</option>
            <option value="delivery">Deliveries</option>
            <option value="project">Project Phases</option>
            <option value="meeting">Meetings</option>
            <option value="leave">Artist Leaves</option>
            <option value="holiday">Holidays</option>
          </select>

          {/* Department Filter */}
          <select
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-medium"
          >
            <option value="ALL">All Departments</option>
            <option value="Compositing">Compositing</option>
            <option value="FX Simulation">FX Simulation</option>
            <option value="Matchmove & Tracking">Matchmove</option>
            <option value="Character Animation">Animation</option>
            <option value="Lighting & LookDev">Lighting</option>
            <option value="VFX Supervision">VFX Supervision</option>
            <option value="Editorial & Delivery">Editorial</option>
          </select>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Loading production scheduling matrix...
            </div>
          </div>
        ) : (
          <>
            {activeView === 'month' && (
              <CalendarMonthView
                currentDate={currentDate}
                events={filteredEvents}
                holidays={holidays}
                leaves={leaves}
                onSelectEvent={setSelectedEvent}
                onAddEventOnDate={handleOpenAddEventOnDate}
              />
            )}
            {activeView === 'week' && (
              <CalendarWeekView
                currentDate={currentDate}
                events={filteredEvents}
                holidays={holidays}
                leaves={leaves}
                onSelectEvent={setSelectedEvent}
                onAddEventOnDate={handleOpenAddEventOnDate}
              />
            )}
            {activeView === 'day' && (
              <CalendarDayView
                currentDate={currentDate}
                events={filteredEvents}
                resources={resources}
                holidays={holidays}
                leaves={leaves}
                onSelectEvent={setSelectedEvent}
                onAddEvent={() => {
                  setInitialCreateDate(currentDate);
                  setIsCreateModalOpen(true);
                }}
              />
            )}
            {activeView === 'timeline' && (
              <CalendarTimelineView
                currentDate={currentDate}
                events={filteredEvents}
                resources={resources}
                onSelectEvent={setSelectedEvent}
              />
            )}
            {activeView === 'resources' && (
              <ResourceGridView
                resources={filteredResources}
                onSelectResource={(res) => {
                  // Filter by assignee or toggle timeline
                  setFilters({ ...filters, assigneeId: res.id });
                  setActiveView('timeline');
                }}
              />
            )}
            {activeView === 'capacity' && (
              <ResourceCapacityView
                capacitySummaries={capacitySummaries}
                resources={resources}
              />
            )}
            {activeView === 'utilization' && (
              <ResourceUtilizationView
                resources={resources}
                capacitySummaries={capacitySummaries}
              />
            )}
            {activeView === 'assignments' && (
              <ResourceAssignmentsView
                resources={resources}
                events={filteredEvents}
                onSelectEvent={setSelectedEvent}
                onAddAssignment={() => {
                  setInitialCreateDate(currentDate);
                  setIsCreateModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Modals & Drawers */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onUpdate={updateEvent}
        onDelete={deleteEvent}
      />

      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createEvent}
        resources={resources}
        initialDate={initialCreateDate}
      />

      <OverbookingAlertDrawer
        isOpen={isOverbookingDrawerOpen}
        onClose={() => setIsOverbookingDrawerOpen(false)}
        alerts={overbookingAlerts}
        resources={resources}
        onResolve={resolveOverbooking}
      />
    </div>
  );
};
