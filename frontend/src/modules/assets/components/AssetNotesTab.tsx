import React, { useState } from 'react';
import type { Asset } from '@/types/production';
import { SmartImg } from '@/components/ui/SmartImg';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import {
  MessageSquare,
  Plus,
  Filter,
  User,
  Clock,
  Sparkles,
  Shield,
  Layers,
  Palette,
  Cpu,
} from 'lucide-react';

interface AssetNotesTabProps {
  asset: Asset;
  onOpenAddNote?: () => void;
}

export const AssetNotesTab: React.FC<AssetNotesTabProps> = ({ asset, onOpenAddNote }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const notesList = [
    {
      id: 'n-001',
      category: 'Creative',
      department: 'LookDev & Shading',
      author: 'Alex Chen',
      role: 'VFX Supervisor',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      timestamp: '2 hours ago',
      content:
        'LookDev dailies turnaround looks great. Please increase clearcoat micro-roughness slightly on the main canopy glass to match anamorphic camera lens flares.',
      pinned: true,
    },
    {
      id: 'n-002',
      category: 'Technical',
      department: '3D Modeling & Assets',
      author: 'Sarah Jenkins',
      role: 'Lead Modeler',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      timestamp: 'Yesterday at 16:45',
      content:
        'LOD0 mesh quads cleaned up. Bounding box extents match master USD stage layout. Subdivision surface hierarchy verified for Pixar RenderMan and Karma rendering.',
      pinned: false,
    },
    {
      id: 'n-003',
      category: 'Rigging',
      department: 'Character & Creature Rigging',
      author: 'Marcus Vance',
      role: 'Lead Rigging TD',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      timestamp: '3 days ago',
      content:
        'USD Skel deformation weights mapped. Secondary landing gear hydraulic pistons have inverse kinematics and collision locators configured.',
      pinned: false,
    },
    {
      id: 'n-004',
      category: 'Editorial',
      department: 'Layout & Turnover',
      author: 'David Mercer',
      role: 'Layout Lead',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      timestamp: '5 days ago',
      content:
        'Referenced asset in sequences SQ01, SQ02, SQ03. Set dressers have placed hero vehicle on the flight deck stage.',
      pinned: false,
    },
  ];

  const filteredNotes = notesList.filter((note) => {
    if (selectedCategory !== 'ALL' && note.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            Production Notes & Supervisor Directives
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Creative reviews, technical QA comments, and department handoff notes for {asset.name}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            >
              <option value="ALL">All Categories</option>
              <option value="Creative">Creative Direction</option>
              <option value="Technical">Technical & Topology</option>
              <option value="LookDev">LookDev & Shading</option>
              <option value="Rigging">Rigging & USD Skel</option>
              <option value="Editorial">Editorial & Layout</option>
            </select>
          </div>

          {onOpenAddNote && (
            <Button
              size="sm"
              variant="primary"
              onClick={onOpenAddNote}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Note
            </Button>
          )}
        </div>
      </div>

      {/* Notes Stream */}
      <div className="space-y-4">
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className={`p-4 rounded-xl border transition-all ${
              note.pinned
                ? 'bg-slate-900/90 border-indigo-500/40 shadow-md'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center space-x-3">
                <SmartImg
                  src={note.avatar}
                  alt={note.author}
                  className="w-8 h-8 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-white">{note.author}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({note.role})</span>
                    {note.pinned && (
                      <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 text-[9px] font-mono rounded">
                        PINNED
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {note.department}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold border ${
                    note.category === 'Creative'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : note.category === 'Technical'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : note.category === 'Rigging'
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {note.category}
                </span>
                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-600" /> {note.timestamp}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-3 pl-11 leading-relaxed font-sans">
              {note.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
