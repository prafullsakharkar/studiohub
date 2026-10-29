import type React from 'react';
import { Modal } from './Modal';
import { Keyboard, Command } from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General & Navigation',
    items: [
      { keys: ['⌘', 'K'], description: 'Open global command palette & search' },
      { keys: ['?'], description: 'Open keyboard shortcuts dialog' },
      { keys: ['G', 'H'], description: 'Launch Getting Started navigation tour' },
      { keys: ['Esc'], description: 'Close active drawer, modal, or overlay' },
      { keys: ['G', 'T'], description: 'Navigate to Tasks Workspace' },
      { keys: ['G', 'S'], description: 'Navigate to Shots Roster' },
    ],
  },
  {
    title: 'Views & Display',
    items: [
      { keys: ['1'], description: 'Switch to Table View' },
      { keys: ['2'], description: 'Switch to Kanban Board View' },
      { keys: ['3'], description: 'Switch to Timeline / Gantt View' },
      { keys: ['4'], description: 'Switch to Media Gallery View' },
    ],
  },
  {
    title: 'Data & Editing',
    items: [
      { keys: ['C'], description: 'Quick create new record in active view' },
      { keys: ['⌘', 'S'], description: 'Save current filter & view layout' },
      { keys: ['⌘', 'Enter'], description: 'Submit active form or dialog' },
      { keys: ['/'], description: 'Focus search input in current list' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-indigo-400" />
          <span>Studio Keyboard Shortcuts</span>
        </div>
      }
      subtitle="Navigate and control production workflows at enterprise speed"
      size="lg"
    >
      <div className="space-y-6 py-2">
        {shortcutGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {group.title}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {group.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80"
                >
                  <span className="text-xs text-slate-300">{item.description}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="px-2 py-1 text-[11px] font-mono font-semibold bg-slate-800 border border-slate-700 rounded shadow-sm text-slate-200"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-center gap-2 text-xs text-indigo-300">
          <Command className="w-4 h-4 shrink-0 text-indigo-400" />
          <span>Press ⌘+K at any time to access instant commands and deep search.</span>
        </div>
      </div>
    </Modal>
  );
};

export default KeyboardShortcutsModal;
