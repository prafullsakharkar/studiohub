import React, { useState, useRef, useEffect } from 'react';
import {
  PlaySquare,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Pencil,
  Square,
  MoveRight,
  Trash2,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link } from 'react-router-dom';

interface ProjectReviewsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

interface ReviewComment {
  id: string;
  user: string;
  role: string;
  avatar: string;
  frame: number;
  timecode: string;
  text: string;
  verdict?: 'Approved' | 'Retake' | 'Note';
  timestamp: string;
}

export const ProjectReviewsTab: React.FC<ProjectReviewsTabProps> = ({ project }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1042);
  const [startFrame] = useState(1001);
  const [endFrame] = useState(1120);
  const [colorLut, setColorLut] = useState<'ACEScg' | 'Rec.709' | 'sRGB' | 'LogC'>('ACEScg');
  const [activeTool, setActiveTool] = useState<'pen' | 'rect' | 'arrow' | 'none'>('pen');
  const [markupColor, setMarkupColor] = useState('#ef4444');
  const [commentInput, setCommentInput] = useState('');

  const addNotification = useNotificationStore((state) => state.addNotification);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  const [comments, setComments] = useState<ReviewComment[]>([
    {
      id: 'rc-1',
      user: 'Alex Chen',
      role: 'VFX Supervisor',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      frame: 1024,
      timecode: '01:00:14:08',
      text: 'Good velocity on the hover engine sparks. Increase secondary smoke opacity by 15%.',
      verdict: 'Note',
      timestamp: 'Today, 10:15 AM',
    },
    {
      id: 'rc-2',
      user: 'Elena Rostova',
      role: 'Lead Compositor',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      frame: 1042,
      timecode: '01:00:15:02',
      text: 'Deep compositing holdout corrected for background neon high-rises. Ready for supervisor sign-off.',
      verdict: 'Approved',
      timestamp: 'Today, 11:30 AM',
    },
  ]);

  // Frame playback ticker
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentFrame((prev) => (prev >= endFrame ? startFrame : prev + 1));
      }, 1000 / project.fps);
    }
    return () => clearInterval(interval);
  }, [isPlaying, endFrame, startFrame, project.fps]);

  // Canvas drawing handlers
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = markupColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || activeTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDraw = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    const newComment: ReviewComment = {
      id: `rc-${Date.now()}`,
      user: 'Supervisor Alex Chen',
      role: 'VFX Supervisor',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      frame: currentFrame,
      timecode: `01:00:${Math.floor((currentFrame - 1000) / 24)
        .toString()
        .padStart(2, '0')}:${((currentFrame - 1000) % 24).toString().padStart(2, '0')}`,
      text: commentInput,
      verdict: 'Note',
      timestamp: 'Just now',
    };

    setComments([newComment, ...comments]);
    setCommentInput('');
    addNotification({
      type: 'info',
      title: 'Review Annotation Added',
      message: `Note pinned at frame ${currentFrame}.`,
    });
  };

  const handleVerdict = (verdict: 'Approved' | 'Retake') => {
    addNotification({
      type: verdict === 'Approved' ? 'success' : 'warning',
      title: `Version ${verdict}`,
      message: `Shot ${project.code}_010_010 v004 marked as ${verdict}.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Screening Room Header */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <PlaySquare className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              {project.code}_010_010 v004 — Dailies Screening Room
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              OpenEXR 16-bit ACEScg • 4096x2160 • {project.fps} FPS • OCIO v2.1
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* LUT Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-[10px] text-slate-500 px-1.5 uppercase">LUT:</span>
            {(['ACEScg', 'Rec.709', 'sRGB', 'LogC'] as const).map((lut) => (
              <button
                key={lut}
                onClick={() => setColorLut(lut)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  colorLut === lut ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lut}
              </button>
            ))}
          </div>

          <Link to="/reviews">
            <Button size="sm" variant="ghost" rightIcon={<ExternalLink className="w-3 h-3" />}>
              Multi-Cut Sync
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Review Player + Annotations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Viewport Stage (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative bg-black rounded-xl border border-slate-800 overflow-hidden shadow-2xl aspect-video flex items-center justify-center group">
            {/* Viewport Image Plate */}
            <img
              src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&auto=format&fit=crop&q=80"
              alt="Review Plate"
              className="w-full h-full object-cover select-none"
            />

            {/* Drawing Markup Canvas Overlay */}
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              className={`absolute inset-0 w-full h-full z-10 ${
                activeTool !== 'none' ? 'cursor-crosshair' : 'cursor-default pointer-events-none'
              }`}
            />

            {/* Viewport HUD Overlays */}
            <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-700 text-xs font-mono text-white flex items-center gap-2">
              <span className="text-indigo-400 font-bold">{project.code}_010_010</span>
              <span className="text-slate-400">|</span>
              <span>F: {currentFrame}</span>
              <span className="text-slate-400">|</span>
              <span className="text-amber-400">LUT: {colorLut}</span>
            </div>

            <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-700 text-xs font-mono text-emerald-400">
              ● ACEScg Color Accurate
            </div>
          </div>

          {/* Scrubber and Playback Bar */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono font-bold text-white shrink-0">{startFrame}</span>
              <input
                type="range"
                min={startFrame}
                max={endFrame}
                value={currentFrame}
                onChange={(e) => setCurrentFrame(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-950 cursor-pointer h-2 rounded-lg"
              />
              <span className="text-xs font-mono font-bold text-white shrink-0">{endFrame}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setCurrentFrame(startFrame)}
                  className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300"
                  title="First Frame"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white px-3 font-mono text-xs flex items-center gap-1 font-bold"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => setCurrentFrame(endFrame)}
                  className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300"
                  title="Last Frame"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Annotation Tools */}
              <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setActiveTool(activeTool === 'pen' ? 'none' : 'pen')}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    activeTool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Draw Markup"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1 px-1 border-l border-slate-800">
                  {['#ef4444', '#f59e0b', '#06b6d4', '#10b981'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setMarkupColor(c)}
                      className={`w-3.5 h-3.5 rounded-full border ${
                        markupColor === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={clearCanvas}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-400"
                  title="Clear Annotations"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Supervisor Verdict Buttons */}
              <div className="flex items-center space-x-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVerdict('Retake')}
                  className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 text-xs"
                >
                  Request Retake
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleVerdict('Approved')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                >
                  Approve Cut
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Review Notes & Frame Comments Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                Frame Notes & Director Remarks ({comments.length})
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {comments.map((c) => (
                <div key={c.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <img src={c.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      <span className="font-bold text-white truncate">{c.user}</span>
                    </div>
                    <span
                      onClick={() => setCurrentFrame(c.frame)}
                      className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-500/20"
                    >
                      Frame {c.frame}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{c.text}</p>
                  <span className="text-[10px] font-mono text-slate-500 block">{c.timestamp}</span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Pin Note at Frame:</span>
              <strong className="text-indigo-400">{currentFrame}</strong>
            </div>
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Type frame note or supervisor instruction..."
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
              <Button size="sm" variant="primary" type="submit">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
