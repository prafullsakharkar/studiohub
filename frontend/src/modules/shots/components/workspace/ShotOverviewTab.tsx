import React, { useState } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { Shot } from '@/types/production';
import { ProductionStatus } from '@/types/common';
import { Task } from '@/types/production';
import { ProductionVersion } from '@/types/production';
import {
  Film,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Users,
  CheckSquare,
  GitBranch,
  Play,
  Maximize2,
  Calendar,
  AlertCircle,
  FileText,
  ShieldCheck,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { useShotMutations } from '@/modules/shots/hooks/useShotMutations';

export interface ShotOverviewTabProps {
  shot: Shot;
  tasks: Task[];
  versions: ProductionVersion[];
  onNavigateTab: (tabId: string) => void;
  onOpenEdit: () => void;
  onOpenAssign: () => void;
  onOpenCreateTask: () => void;
  onOpenSubmitVersion: () => void;
}

export const ShotOverviewTab: React.FC<ShotOverviewTabProps> = ({
  shot,
  tasks,
  versions,
  onNavigateTab,
  onOpenEdit,
  onOpenAssign,
  onOpenCreateTask,
  onOpenSubmitVersion,
}) => {
  const { updateShot, approveShot, isUpdating, isApproving } = useShotMutations();
  const [isPlaying, setIsPlaying] = useState(false);

  // Pipeline stage handling
  const pipelineStages = ['layout', 'animation', 'fx', 'lighting', 'comp'] as const;

  const handleStageCycle = async (stage: typeof pipelineStages[number], currentVal: string) => {
    const nextVal: ProductionStatus =
      currentVal === 'Approved'
        ? 'Not Started'
        : currentVal === 'In Progress' || currentVal === 'WIP'
        ? 'Approved'
        : 'In Progress';

    const updatedPipeline = {
      ...(shot.pipeline || {
        layout: 'Not Started',
        animation: 'Not Started',
        fx: 'Not Started',
        lighting: 'Not Started',
        comp: 'Not Started',
      }),
      [stage]: nextVal,
    };

    await updateShot({
      id: shot.id,
      data: {
        pipeline: updatedPipeline,
      },
    });
  };

  // Task statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Approved' || t.status === 'Completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress' || t.status === 'WIP').length;
  const taskProgressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Latest version
  const latestVersion = versions[0];

  return (
    <div className="space-y-6">
      {/* Top Grid: Media Showcase & Pipeline Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Media Preview Player (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-800 bg-slate-900/90 overflow-hidden shadow-lg">
            <div className="relative aspect-video bg-black flex items-center justify-center group overflow-hidden">
              {shot.thumbnail_url ? (
                <SmartImg
                  src={shot.thumbnail_url}
                  alt={shot.code}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-600 gap-2">
                  <Film className="w-12 h-12" />
                  <span className="text-xs font-mono">No Render Media Ingested</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/40 opacity-80" />

              {/* Timecode & Frame overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[11px] font-mono text-indigo-300 border border-indigo-500/30">
                  {shot.code}
                </span>
                <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[11px] font-mono text-slate-300 border border-slate-700">
                  F: {shot.frame_in} - {shot.frame_out} ({shot.frame_count}f)
                </span>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[11px] font-mono text-emerald-400 border border-emerald-500/30">
                  ACEScg • 24.00 fps
                </span>
              </div>

              {/* Center Play Button */}
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute inset-0 m-auto w-14 h-14 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl hover:bg-indigo-500 hover:scale-110 transition-all border border-indigo-400/40"
              >
                <Play className="w-6 h-6 ml-1 fill-white" />
              </button>

              {/* Bottom Scrubber simulation */}
              <div className="absolute bottom-0 inset-x-0 p-3 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-indigo-400 font-bold">{shot.current_version || 'v001'}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">4096 × 1716 Scope (2.39:1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigateTab('media')}
                    className="hover:text-white flex items-center gap-1 text-[11px] text-slate-400"
                  >
                    Open Player <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <CardBody className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Pipeline Stages
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">(Click stage to cycle)</span>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={onOpenEdit}
                  className="text-[11px]"
                >
                  Edit Specs
                </Button>
              </div>

              {/* Pipeline Stage Buttons */}
              <div className="grid grid-cols-5 gap-2">
                {pipelineStages.map((stage) => {
                  const stageVal = (shot.pipeline as any)?.[stage] || 'Not Started';
                  const isApproved = stageVal === 'Approved';
                  const isInProg = stageVal === 'In Progress' || stageVal === 'WIP';

                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => handleStageCycle(stage, stageVal)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between h-16 ${
                        isApproved
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-xs'
                          : isInProg
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wider font-mono">
                        {stage}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-semibold">
                        <span className="truncate">{stageVal}</span>
                        {isApproved && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right: Technical Specs & Approval Seals (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Frame Range & Editorial Specs Card */}
          <Card className="border-slate-800 bg-slate-900/90 shadow-md">
            <CardHeader className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Editorial & Frame Specs</h3>
              </div>
              <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                24.00 FPS
              </span>
            </CardHeader>

            <CardBody className="p-4 space-y-3.5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Head / In</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">{shot.frame_in}</div>
                  <div className="text-[9px] text-slate-500 font-mono">TC 01:00:04:01</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Tail / Out</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">{shot.frame_out}</div>
                  <div className="text-[9px] text-slate-500 font-mono">TC 01:00:09:00</div>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30">
                  <div className="text-[10px] font-mono text-indigo-400 uppercase">Cut Duration</div>
                  <div className="text-sm font-bold font-mono text-indigo-200 mt-0.5">
                    {shot.frame_count} f
                  </div>
                  <div className="text-[9px] text-indigo-400/80 font-mono">
                    {(shot.frame_count / 24).toFixed(2)}s
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-800/60 text-xs text-slate-300">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Head / Tail Handles:</span>
                  <span className="font-mono text-white font-semibold">
                    {shot.handle_frames || 8} frames each
                  </span>
                </div>

                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Sequence Context:</span>
                  <span className="font-mono text-indigo-400 font-bold">{shot.sequence_code}</span>
                </div>

                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Primary Department:</span>
                  <span className="font-semibold text-white">{shot.department || 'Compositing'}</span>
                </div>

                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-400">Resolution & Format:</span>
                  <span className="font-mono text-slate-300">4096 × 1716 DCI 4K</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Supervisor & Client Approval Seals */}
          <Card className="border-slate-800 bg-slate-900/90 shadow-md">
            <CardHeader className="pb-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Quality Seals & Approvals</h3>
              </div>
              {shot.status === 'Approved' ? (
                <Badge variant="success" className="text-[10px] uppercase font-mono">
                  Final Approved
                </Badge>
              ) : (
                <Badge variant="warning" className="text-[10px] uppercase font-mono">
                  In Pipeline
                </Badge>
              )}
            </CardHeader>

            <CardBody className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      shot.supervisor_approved || shot.status === 'Approved'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">VFX Supervisor Sign-off</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {shot.supervisor_approved || shot.status === 'Approved'
                        ? 'Approved & Locked by Supervisor'
                        : 'Pending supervisor final review'}
                    </div>
                  </div>
                </div>

                {!(shot.supervisor_approved || shot.status === 'Approved') && (
                  <Button
                    size="xs"
                    variant="primary"
                    isLoading={isApproving}
                    onClick={() => approveShot(shot.id)}
                    className="text-xs"
                  >
                    Sign Off
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      shot.client_approved
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Client Studio Approval</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {shot.client_approved
                        ? 'Delivered & Accepted by Client'
                        : 'Awaiting turnover package delivery'}
                    </div>
                  </div>
                </div>

                {shot.client_approved && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">LOCKED</span>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Middle Row: Staffing Roster + Task Progress + Notes Brief */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Team & Staffing Card */}
        <Card className="border-slate-800 bg-slate-900/90 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Staffing & Assignments</h3>
            </div>
            <Button size="xs" variant="ghost" onClick={onOpenAssign} className="text-xs text-indigo-400 hover:text-indigo-300">
              Reassign
            </Button>
          </CardHeader>

          <CardBody className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
                {(shot.assigned_artist_name || 'U')[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">
                  {shot.assigned_artist_name || 'Unassigned Artist'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Primary {shot.department || 'Lead Artist'}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">Assigned Team:</span>
              <span className="font-mono text-slate-300">{shot.assigned_team_name || 'Core Production Crew'}</span>
            </div>

            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-slate-400">Sequence Lead:</span>
              <span className="font-mono text-slate-300">Alex Chen (Supervisor)</span>
            </div>
          </CardBody>
        </Card>

        {/* Task Progress Summary Card */}
        <Card className="border-slate-800 bg-slate-900/90 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Tasks Progress</h3>
            </div>
            <Button size="xs" variant="ghost" onClick={() => onNavigateTab('tasks')} className="text-xs text-indigo-400 hover:text-indigo-300">
              View All ({totalTasks})
            </Button>
          </CardHeader>

          <CardBody className="p-4 space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold text-white font-mono">{taskProgressPct}%</div>
                <div className="text-[11px] text-slate-400">Completion rate across steps</div>
              </div>
              <div className="text-right text-xs font-mono text-slate-400">
                <span className="text-emerald-400 font-bold">{completedTasks}</span> / {totalTasks} Tasks
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${taskProgressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-center text-xs">
              <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-amber-400 font-bold font-mono">{inProgressTasks}</span>
                <span className="text-slate-500 ml-1">In Progress</span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-emerald-400 font-bold font-mono">{completedTasks}</span>
                <span className="text-slate-500 ml-1">Approved</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Editorial Brief & Turnover Notes Card */}
        <Card className="border-slate-800 bg-slate-900/90 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Editorial Brief</h3>
            </div>
            <Button size="xs" variant="ghost" onClick={() => onNavigateTab('notes')} className="text-xs text-indigo-400 hover:text-indigo-300">
              All Notes
            </Button>
          </CardHeader>

          <CardBody className="p-4 space-y-2">
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-4 italic bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              {shot.notes ||
                'Turnover note: Match plate lighting carefully to sequence hero master. Clean out tracking markers in background. Depth of field starts at 12 feet.'}
            </p>

            <div className="flex items-center gap-2 pt-1">
              {(shot.tags || ['VFX', 'Comp', 'Hero']).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
