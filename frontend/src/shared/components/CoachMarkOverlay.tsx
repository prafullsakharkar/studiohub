import type React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Compass,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { useCoachMarkStore, COACH_MARK_STEPS } from '@/shared/stores/useCoachMarkStore';
import { Button } from '@/shared/components/Button';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const CoachMarkOverlay: React.FC = () => {
  const {
    isActive,
    currentStepIndex,
    nextStep,
    prevStep,
    endTour,
    goToStep,
  } = useCoachMarkStore();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentStep = COACH_MARK_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === COACH_MARK_STEPS.length - 1;

  // Calculate coordinates of target element with fallback
  const updateTargetPosition = useCallback(() => {
    if (!isActive || !currentStep) return;

    let el = document.getElementById(currentStep.targetId);
    // If exact ID not found (e.g. mobile vs desktop variants), try fallback
    if (!el && currentStep.targetId === 'global-command-palette-btn') {
      el = document.getElementById('global-command-palette-mobile-btn');
    }

    if (el) {
      const rect = el.getBoundingClientRect();
      // Ensure target is visible or scroll into view smoothly
      if (
        rect.top < 0 ||
        rect.bottom > window.innerHeight ||
        rect.left < 0 ||
        rect.right > window.innerWidth
      ) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      });

      // Compute popover placement based on step preference and viewport bounds
      const padding = 12;
      const popoverWidth = Math.min(380, window.innerWidth - 32);
      const popoverHeight = 240; // estimation for boundary protection

      let top = rect.bottom + padding;
      let left = rect.left;

      if (currentStep.position === 'right') {
        left = rect.right + padding;
        top = Math.max(16, Math.min(rect.top + 20, window.innerHeight - popoverHeight - 16));
      } else if (currentStep.position === 'bottom-end') {
        left = rect.right - popoverWidth;
        top = rect.bottom + padding;
      } else if (currentStep.position === 'bottom-start') {
        left = rect.left;
        top = rect.bottom + padding;
      } else if (currentStep.position === 'bottom') {
        left = rect.left + rect.width / 2 - popoverWidth / 2;
        top = rect.bottom + padding;
      }

      // Constrain inside viewport
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }
      if (top + popoverHeight > window.innerHeight - 16) {
        // flip above target if insufficient space below
        top = Math.max(16, rect.top - popoverHeight - padding);
      }

      setPopoverPos({ top, left });
    } else {
      // Fallback center position if target not present in current responsive layout
      const popoverWidth = Math.min(380, window.innerWidth - 32);
      setTargetRect(null);
      setPopoverPos({
        top: Math.max(80, window.innerHeight / 2 - 120),
        left: Math.max(16, window.innerWidth / 2 - popoverWidth / 2),
      });
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive) return;

    updateTargetPosition();

    const handleResizeOrScroll = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        endTour(true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, currentStepIndex, updateTargetPosition, endTour, nextStep, prevStep]);

  if (!isActive || !currentStep) return null;

  return (
    <AnimatePresence>
      <div
        id="coach-mark-overlay-backdrop"
        className="fixed inset-0 z-50 pointer-events-auto select-none"
        aria-modal="true"
        role="dialog"
        aria-labelledby="coach-mark-title"
        aria-describedby="coach-mark-desc"
      >
        {/* SVG Spotlight Mask to cutout the active target */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300"
          style={{ width: '100vw', height: '100vh' }}
        >
          <defs>
            <mask id="coach-mark-spotlight-mask">
              {/* White background: dark overlay */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black cutout over target element: transparent spotlight */}
              {targetRect && (
                <rect
                  x={targetRect.left - 6}
                  y={targetRect.top - 6}
                  width={targetRect.width + 12}
                  height={targetRect.height + 12}
                  rx="10"
                  ry="10"
                  fill="black"
                  className="transition-all duration-300 ease-out"
                />
              )}
            </mask>
          </defs>
          {/* Backdrop fill with cutout */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(2, 6, 23, 0.72)"
            mask="url(#coach-mark-spotlight-mask)"
            className="backdrop-blur-[2px] transition-all duration-300"
          />
        </svg>

        {/* Pulsing Highlight Ring around the Target */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
            className="absolute pointer-events-none rounded-xl border-2 border-cyan-400/90 shadow-[0_0_24px_rgba(6,182,212,0.45)] ring-4 ring-cyan-500/20"
          />
        )}

        {/* Backdrop click dismiss handler */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => endTour(true)}
          title="Click backdrop to exit tour"
        />

        {/* Popover Card */}
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          style={{
            top: popoverPos.top,
            left: popoverPos.left,
            width: Math.min(380, window.innerWidth - 32),
          }}
          className="absolute z-50 bg-slate-900/95 text-slate-100 rounded-2xl border border-cyan-500/40 shadow-2xl shadow-cyan-950/50 p-4 sm:p-5 backdrop-blur-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Step {currentStepIndex + 1} of {COACH_MARK_STEPS.length}
              </span>
              {currentStep.shortcutHint && (
                <span className="hidden sm:inline-flex text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                  {currentStep.shortcutHint}
                </span>
              )}
            </div>

            <button
              id="coach-mark-skip-btn"
              onClick={() => endTour(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Skip guided tour"
              aria-label="Skip tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5 mb-4">
            <h3 id="coach-mark-title" className="text-sm sm:text-base font-bold text-white tracking-tight">
              {currentStep.title}
            </h3>
            <p id="coach-mark-desc" className="text-xs text-slate-300/90 leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          {/* Step Progress Indicators */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5">
              {COACH_MARK_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => goToStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'w-6 bg-cyan-400'
                      : idx < currentStepIndex
                      ? 'w-2 bg-cyan-700/60 hover:bg-cyan-600'
                      : 'w-2 bg-slate-700 hover:bg-slate-600'
                  }`}
                  title={`Go to ${step.title}`}
                  aria-label={`Go to step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  id="coach-mark-prev-btn"
                  onClick={prevStep}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <Button
                id="coach-mark-next-btn"
                variant="primary"
                size="sm"
                onClick={nextStep}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                <span>{isLastStep ? 'Finish Tour' : 'Next'}</span>
                {isLastStep ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-950" />
                )}
              </Button>
            </div>
          </div>

          {/* Keyboard tip */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-500">
            <span>Use arrow keys (←/→) to navigate</span>
            <span className="font-mono">ESC to exit</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/**
 * Non-intrusive "Getting Started" Banner / Toast for first-time studio users.
 * Sits quietly in the bottom corner without obstructing the view.
 */
export const GettingStartedBanner: React.FC = () => {
  const { showStarterCard, startTour, dismissStarterCard } = useCoachMarkStore();

  if (!showStarterCard) return null;

  return (
    <div
      id="getting-started-banner"
      className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100vw-2rem)] sm:w-88 rounded-2xl bg-slate-900/95 border border-cyan-500/30 p-4 shadow-2xl shadow-cyan-950/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
          <Compass className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Welcome to StudioHub
            </h4>
            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
              New
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Take a 30-second non-intrusive walkthrough highlighting key navigation rails, show switchers, and pipeline workspaces.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <Button
              id="start-getting-started-tour-btn"
              variant="primary"
              size="xs"
              onClick={startTour}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-slate-950" />
              <span>Start Quick Tour</span>
            </Button>

            <button
              id="dismiss-getting-started-banner-btn"
              onClick={dismissStarterCard}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Maybe later
            </button>
          </div>
        </div>

        <button
          onClick={dismissStarterCard}
          className="text-slate-500 hover:text-slate-300 p-1 rounded-md transition-colors -mr-1 -mt-1 cursor-pointer"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
