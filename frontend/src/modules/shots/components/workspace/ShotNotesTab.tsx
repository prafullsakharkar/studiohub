import React, { useState } from 'react';
import { Shot } from '@/types/production';
import {
  MessageSquare,
  Plus,
  Tag,
  User,
  Clock,
  Sparkles,
  ShieldCheck,
  Film,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export interface ShotNotesTabProps {
  shot: Shot;
  onOpenAddNote: () => void;
}

export const ShotNotesTab: React.FC<ShotNotesTabProps> = ({ shot, onOpenAddNote }) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const notesList = [
    {
      id: 'n-1',
      category: 'Editorial',
      author: 'Editorial Department (AVID)',
      role: 'Ingest & Conforming',
      date: '2 days ago',
      content:
        shot.notes ||
        'Conform turnover from timeline edit. Cut duration is locked at 120 frames with 8-frame head/tail handles. Timecode sync verified against camera master.',
      department: 'Editorial',
    },
    {
      id: 'n-2',
      category: 'Creative',
      author: 'Alex Chen',
      role: 'VFX Supervisor',
      date: 'Yesterday at 18:20',
      content:
        'Pay special attention to the atmospheric heat distortion in the background horizon. Use physical optics defocus on anamorphic lens edges.',
      department: 'Compositing',
    },
    {
      id: 'n-3',
      category: 'Technical',
      author: 'Pipeline TD Roster',
      role: 'Color & IO',
      date: '3 days ago',
      content:
        'ACES 1.3 OCIO config loaded. Input color space is Sony S-Gamut3.Cine / S-Log3, working space ACEScg.',
      department: 'Color / IO',
    },
  ];

  const filteredNotes =
    activeCategory === 'ALL'
      ? notesList
      : notesList.filter((n) => n.category === activeCategory);

  return (
    <div className="space-y-4">
      {/* Filter and action bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {['ALL', 'Creative', 'Editorial', 'Technical'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenAddNote}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Note
        </Button>
      </div>

      {/* Notes stream */}
      <div className="space-y-3">
        {filteredNotes.map((note) => (
          <Card key={note.id} className="border-slate-800 bg-slate-900 shadow-md">
            <CardBody className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center justify-center font-bold text-xs">
                    {note.author[0]}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{note.author}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                        ({note.role})
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">{note.date}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      note.category === 'Creative'
                        ? 'info'
                        : note.category === 'Editorial'
                        ? 'warning'
                        : 'neutral'
                    }
                    className="text-[10px] font-mono uppercase"
                  >
                    {note.category}
                  </Badge>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {note.department}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {note.content}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};
