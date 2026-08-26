import React, { useState } from 'react';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useTimelogMutations } from '../hooks/useTimelogs';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { TimelogCreateModal } from './TimelogCreateModal';
import {
  Play,
  Pause,
  Square,
  Clock,
  DollarSign,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export const ActiveTimerBanner: React.FC = () => {
  const {
    isRunning,
    activeTaskId,
    activeTaskCode,
    activeTaskTitle,
    activeProjectId,
    activeProjectCode,
    department,
    elapsedSeconds,
    isBillable,
    notes,
    pauseTimer,
    resumeTimer,
    stopTimer,
    setNotes,
    setIsBillable,
  } = useTimerStore();

  const { createTimelog } = useTimelogMutations();
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  if (!activeTaskId) return null;

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const durationHoursDecimal = Math.max(0.25, parseFloat((elapsedSeconds / 3600).toFixed(2)));

  const handleStopAndSave = () => {
    setIsLogModalOpen(true);
  };

  const handleModalSubmit = async (data: any) => {
    await createTimelog.mutateAsync(data);
    stopTimer();
    setIsLogModalOpen(false);
  };

  return (
    <>
      <div className="fixed top-16 right-6 z-40 animate-fade-in">
        <div className="bg-slate-900/95 border border-indigo-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex items-center gap-4 text-slate-100 min-w-[340px]">
          {/* Pulse Indicator */}
          <div className="relative flex items-center justify-center">
            <span
              className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
              } absolute`}
            />
            <span
              className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-emerald-500' : 'bg-amber-500'
              } relative`}
            />
          </div>

          {/* Task Info & Live Counter */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-xs text-indigo-400">
              <span className="font-bold">{activeTaskCode}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 truncate">{activeProjectCode}</span>
            </div>
            <div className="text-xs font-semibold text-slate-200 truncate mt-0.5" title={activeTaskTitle || ''}>
              {activeTaskTitle}
            </div>
            <div className="text-sm font-mono font-bold text-white tracking-widest mt-1">
              {timeFormatted}
            </div>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            {isRunning ? (
              <button
                onClick={pauseTimer}
                className="p-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
                title="Pause Timer"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={resumeTimer}
                className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 transition-colors"
                title="Resume Timer"
              >
                <Play className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleStopAndSave}
              className="p-2 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition-colors"
              title="Stop and Log Hours"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isLogModalOpen && (
        <TimelogCreateModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          onSubmit={handleModalSubmit}
          task={{
            id: activeTaskId,
            code: activeTaskCode,
            title: activeTaskTitle,
            project_id: activeProjectId,
            project_code: activeProjectCode,
            department: department as any,
          } as any}
          defaultDurationHours={durationHoursDecimal}
          initialNotes={notes}
          isBillableDefault={isBillable}
        />
      )}
    </>
  );
};
