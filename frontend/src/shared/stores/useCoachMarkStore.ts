import { create } from 'zustand';

export interface CoachMarkStep {
  id: string;
  targetId: string; // DOM element ID to highlight
  title: string;
  description: string;
  category: 'workspace' | 'navigation' | 'productivity' | 'settings';
  shortcutHint?: string;
  position?: 'bottom' | 'top' | 'left' | 'right' | 'bottom-start' | 'bottom-end';
}

export const COACH_MARK_STEPS: CoachMarkStep[] = [
  {
    id: 'step-project-switcher',
    targetId: 'project-switcher-btn',
    title: 'Production Project & Show Switcher',
    description:
      'Set your active show context. All shots, assets, review sessions, and USD scene graphs automatically synchronize to the selected production.',
    category: 'workspace',
    shortcutHint: 'Active Show',
    position: 'bottom-start',
  },
  {
    id: 'step-sidebar-navigation',
    targetId: 'sidebar-nav-container',
    title: 'Pipeline Workspaces & Roster',
    description:
      'Jump directly to Shots, 3D Assets, Tasks, Daily Timelogs, Publishing, and Access & RBAC governance.',
    category: 'navigation',
    shortcutHint: 'G + D/S/T',
    position: 'right',
  },
  {
    id: 'step-command-palette',
    targetId: 'global-command-palette-btn',
    title: 'Global Studio Search & Command Palette',
    description:
      'Press ⌘K to instantly search shots, 3D models, review reels, team members, or trigger studio commands with zero latency.',
    category: 'productivity',
    shortcutHint: '⌘ + K',
    position: 'bottom',
  },
  {
    id: 'step-user-menu',
    targetId: 'user-menu-btn',
    title: 'Crew Identity & Role Simulator',
    description:
      'Inspect permissions, test access as different studio roles (Supervisor, Modeler, Vendor, Client), and manage pipeline settings.',
    category: 'settings',
    shortcutHint: '⌘ + Shift + P',
    position: 'bottom-end',
  },
];

const STORAGE_KEY = 'studiohub_tour_completed_v1';
const DISMISSED_BADGE_KEY = 'studiohub_getting_started_badge_dismissed';

interface CoachMarkState {
  isActive: boolean;
  currentStepIndex: number;
  hasSeenTour: boolean;
  showStarterCard: boolean;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  endTour: (markAsCompleted?: boolean) => void;
  resetTour: () => void;
  dismissStarterCard: () => void;
}

export const useCoachMarkStore = create<CoachMarkState>((set, get) => {
  let initialHasSeen = false;
  let initialDismissedCard = false;

  if (typeof window !== 'undefined') {
    try {
      initialHasSeen = localStorage.getItem(STORAGE_KEY) === 'true';
      initialDismissedCard = localStorage.getItem(DISMISSED_BADGE_KEY) === 'true';
    } catch {
      // localStorage not accessible
    }
  }

  return {
    isActive: false,
    currentStepIndex: 0,
    hasSeenTour: initialHasSeen,
    showStarterCard: !initialHasSeen && !initialDismissedCard,

    startTour: () => {
      set({
        isActive: true,
        currentStepIndex: 0,
        showStarterCard: false,
      });
    },

    nextStep: () => {
      const { currentStepIndex } = get();
      if (currentStepIndex < COACH_MARK_STEPS.length - 1) {
        set({ currentStepIndex: currentStepIndex + 1 });
      } else {
        get().endTour(true);
      }
    },

    prevStep: () => {
      const { currentStepIndex } = get();
      if (currentStepIndex > 0) {
        set({ currentStepIndex: currentStepIndex - 1 });
      }
    },

    goToStep: (index: number) => {
      if (index >= 0 && index < COACH_MARK_STEPS.length) {
        set({ currentStepIndex: index });
      }
    },

    endTour: (markAsCompleted = true) => {
      if (markAsCompleted && typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, 'true');
        } catch {
          // Ignore
        }
      }
      set({
        isActive: false,
        currentStepIndex: 0,
        hasSeenTour: markAsCompleted ? true : get().hasSeenTour,
      });
    },

    resetTour: () => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(DISMISSED_BADGE_KEY);
        } catch {
          // Ignore
        }
      }
      set({
        isActive: true,
        currentStepIndex: 0,
        hasSeenTour: false,
        showStarterCard: false,
      });
    },

    dismissStarterCard: () => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(DISMISSED_BADGE_KEY, 'true');
        } catch {
          // Ignore
        }
      }
      set({ showStarterCard: false });
    },
  };
});
