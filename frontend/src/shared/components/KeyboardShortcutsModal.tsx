import React from 'react';
import { Modal } from './Modal';
import { Command, CornerDownLeft, ArrowUpDown, Sparkles, Navigation, ShieldCheck, Activity, Layers, Film } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const shortcutGroups = [
    {
      title: 'Global Navigation & Command Center',
      shortcuts: [
        { keys: ['⌘', 'K'], desc: 'Open Universal Command Palette & Global Search' },
        { keys: ['?'], desc: 'Open Keyboard Shortcuts Help' },
        { keys: ['Esc'], desc: 'Close dialogs, command palettes & drawers' },
        { keys: ['↑', '↓'], desc: 'Navigate through search results or lists' },
        { keys: ['Enter'], desc: 'Select or execute active command' },
      ],
    },
    {
      title: 'Go-To Navigation (G then Key)',
      shortcuts: [
        { keys: ['G', 'D'], desc: 'Go to Production Dashboard' },
        { keys: ['G', 'P'], desc: 'Go to Projects Portfolio' },
        { keys: ['G', 'S'], desc: 'Go to Shots & Sequences' },
        { keys: ['G', 'A'], desc: 'Go to OpenUSD Assets' },
        { keys: ['G', 'T'], desc: 'Go to Production Tasks' },
        { keys: ['G', 'R'], desc: 'Go to Dailies & Reviews' },
        { keys: ['G', 'O'], desc: 'Go to Organizations' },
        { keys: ['G', 'C'], desc: 'Go to Client Studios' },
        { keys: ['G', 'V'], desc: 'Go to Vendors' },
        { keys: ['G', 'U'], desc: 'Go to People / Crew' },
        { keys: ['G', 'L'], desc: 'Go to Activity & Audit Trail' },
      ],
    },
    {
      title: 'Enterprise Actions & Permissions',
      shortcuts: [
        { keys: ['⌘', 'Shift', 'P'], desc: 'Open Permissions & RBAC Matrix' },
        { keys: ['⌘', 'Shift', 'A'], desc: 'Quick Action Dispatcher' },
        { keys: ['⌘', 'E'], desc: 'Export Audit Logs (CSV / JSON)' },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="StudioHub Keyboard Navigation & Shortcuts"
      subtitle="Boost your production workflow speed with standard shortcuts"
      size="lg"
    >
      <div className="space-y-6 py-2">
        {shortcutGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-2.5">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">
              {group.title}
            </h4>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl divide-y divide-slate-800/80 overflow-hidden">
              {group.shortcuts.map((sc, sIdx) => (
                <div
                  key={sIdx}
                  className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
                >
                  <span className="text-xs text-slate-300 font-medium">{sc.desc}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sc.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="px-2 py-0.5 min-w-[24px] text-center text-[11px] font-mono font-bold rounded bg-slate-800 text-slate-200 border border-slate-700 shadow-xs"
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
      </div>
    </Modal>
  );
};
