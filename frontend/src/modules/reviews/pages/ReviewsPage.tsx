import React, { useState, useRef, useEffect } from 'react';
import { useReviews } from '../hooks/useReviews';
import { useReviewMutations } from '../hooks/useReviewMutations';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { HasRole } from '@/core/permissions/HasRole';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Film,
  Eye,
  Sliders,
  Send,
  Sparkles,
  Edit3,
  Square,
  Circle,
  MoveUpRight,
  Trash2,
  SplitSquareVertical,
  Layers,
  Activity,
} from 'lucide-react';
import { ReviewSession, ReviewAnnotation } from '@/mocks/db/reviews/reviews';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const ReviewsPage: React.FC = () => {
  const { data, isLoading } = useReviews();
  const reviews = data?.results || [];

  const [selectedReviewId, setSelectedReviewId] = useState<string>('');
  const activeReview = reviews.find((r) => r.id === selectedReviewId) || reviews[0];

  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (reviews.length > 0 && !selectedReviewId) {
      setSelectedReviewId(reviews[0].id);
    }
  }, [reviews, selectedReviewId]);

  const { addAnnotation, submitVerdict, isAddingAnnotation, isSubmittingVerdict } = useReviewMutations();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [totalFrames, setTotalFrames] = useState(192);
  const [fps, setFps] = useState(24);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [lutProfile, setLutProfile] = useState<'aces' | 'rec709' | 'srgb' | 'raw'>('aces');
  const [newComment, setNewComment] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');

  // A/B Wipe Comparison Mode
  const [isAbWipeActive, setIsAbWipeActive] = useState(false);
  const [wipePercent, setWipePercent] = useState(50);

  // Drawing Tools
  const [activeDrawTool, setActiveDrawTool] = useState<'none' | 'pen' | 'rect' | 'arrow'>('none');
  const [drawColor, setDrawColor] = useState('#f59e0b');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPos, setDrawStartPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (activeReview) {
      setFps(activeReview.fps || 24);
      setTotalFrames(activeReview.total_frames || 192);
      setCurrentFrame(1);
      setVideoError(false);
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = 0;
        } catch {
          // Ignore
        }
        setIsPlaying(false);
      }
      clearCanvas();
    }
  }, [activeReview?.id]);

  // Frame timer for simulation or when video error occurs
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && (!videoRef.current || videoError)) {
      interval = setInterval(() => {
        setCurrentFrame((prev) => (prev >= totalFrames ? 1 : prev + 1));
      }, 1000 / fps);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, videoError, totalFrames, fps]);

  const togglePlay = () => {
    if (videoRef.current && !videoError && activeReview?.video_url) {
      if (isPlaying) {
        try {
          videoRef.current.pause();
        } catch {
          // Ignore
        }
        setIsPlaying(false);
      } else {
        videoRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            setVideoError(true);
            setIsPlaying(true);
          });
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || videoError) return;
    try {
      const time = videoRef.current.currentTime;
      const frame = Math.max(1, Math.min(totalFrames, Math.round(time * fps) + 1));
      setCurrentFrame(frame);
    } catch {
      // Ignore
    }
  };

  const seekToFrame = (frameNum: number) => {
    const targetFrame = Math.max(1, Math.min(totalFrames, frameNum));
    setCurrentFrame(targetFrame);
    if (videoRef.current && !videoError) {
      try {
        const targetTime = (targetFrame - 1) / fps;
        videoRef.current.currentTime = targetTime;
      } catch {
        // Ignore
      }
    }
  };

  const stepFrame = (delta: number) => {
    const nextFrame = Math.max(1, Math.min(totalFrames, currentFrame + delta));
    seekToFrame(nextFrame);
  };

  const formatTimecode = (frameNum: number, frameRate: number) => {
    const totalSeconds = Math.floor((frameNum - 1) / frameRate);
    const frames = (frameNum - 1) % frameRate;
    const hours = 1 + Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  // Canvas drawing handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDrawTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setDrawStartPos({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx && activeDrawTool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeDrawTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeDrawTool === 'pen') {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeDrawTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !drawStartPos) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeDrawTool === 'rect') {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(drawStartPos.x, drawStartPos.y, x - drawStartPos.x, y - drawStartPos.y);
    } else if (activeDrawTool === 'arrow') {
      ctx.strokeStyle = drawColor;
      ctx.fillStyle = drawColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(drawStartPos.x, drawStartPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Arrowhead
      const headlen = 12;
      const angle = Math.atan2(y - drawStartPos.y, x - drawStartPos.x);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    setIsDrawing(false);
    setDrawStartPos(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activeReview) return;
    await addAnnotation({
      reviewId: activeReview.id,
      annotation: {
        frame_number: currentFrame,
        timecode: formatTimecode(currentFrame, fps),
        comment: newComment.trim(),
        author_name: 'Dr. Marcus Vance (Supervisor)',
      },
    });
    setNewComment('');
    clearCanvas();
  };

  const handleVerdict = async (verdict: 'Approved' | 'Retake' | 'Pending Review') => {
    if (!activeReview) return;
    await submitVerdict({
      reviewId: activeReview.id,
      verdict,
      notes: supervisorNotes || activeReview.supervisor_notes,
    });
    addNotification({
      type: verdict === 'Approved' ? 'success' : 'warning',
      title: `Dailies Verdict: ${verdict}`,
      message: `${activeReview.entity_code} ${activeReview.version_number} marked as ${verdict}`,
    });
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Connecting to Dailies screening room..." />;
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Film className="w-8 h-8 text-indigo-400" />}
        title="No Active Screening Sessions"
        description="There are currently no VFX review cut sessions available."
      />
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Screening Room Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            Screening Room & Frame-Accurate Dailies
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              {activeReview?.entity_code} {activeReview?.version_number}
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            OpenColorIO ACEScg shader preview, frame markup canvas, A/B wipe comparison, and supervisor sign-offs
          </p>
        </div>

        {/* OCIO LUT and A/B Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAbWipeActive(!isAbWipeActive)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isAbWipeActive
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>A/B Wipe Mode</span>
          </button>

          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
            <span className="text-[10px] font-mono font-semibold text-slate-500 px-1.5">OCIO:</span>
            {(['aces', 'rec709', 'srgb', 'raw'] as const).map((lut) => (
              <button
                key={lut}
                onClick={() => setLutProfile(lut)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold transition-all ${
                  lutProfile === lut
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lut}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Review Room Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Review Queue (3 cols) */}
        <div className="lg:col-span-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Dailies Playlist ({reviews.length})
            </span>
            <span className="text-[10px] font-mono text-indigo-400 font-semibold">24 FPS DCI 4K</span>
          </div>

          <div className="space-y-1.5 max-h-[640px] overflow-y-auto custom-scrollbar pr-1">
            {reviews.map((rev) => {
              const isSelected = rev.id === activeReview?.id;
              return (
                <div
                  key={rev.id}
                  onClick={() => setSelectedReviewId(rev.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex gap-2.5 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-950/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={rev.thumbnail_url}
                    alt={rev.title}
                    className="w-14 h-14 rounded-lg object-cover bg-slate-950 shrink-0 border border-slate-800"
                  />
                  <div className="flex flex-col justify-between min-w-0 flex-1">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-indigo-300 truncate">
                          {rev.entity_code}
                        </span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {rev.version_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-white font-medium line-clamp-1 mt-0.5">{rev.title}</p>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <StatusBadge status={rev.status} />
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <MessageSquare className="w-3 h-3" />
                        {rev.annotations?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Video Player, Scrubber, & Draw Overlay (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          <Card className="bg-slate-900 border-slate-800 overflow-hidden shadow-2xl">
            {/* Viewport Frame with Canvas Overlay */}
            <div
              className={`relative bg-black aspect-video flex items-center justify-center overflow-hidden select-none ${
                lutProfile === 'aces'
                  ? 'brightness-105 contrast-105 saturate-110'
                  : lutProfile === 'raw'
                  ? 'brightness-125 contrast-75 saturate-70'
                  : ''
              }`}
            >
              {activeReview?.video_url && !videoError ? (
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain pointer-events-none"
                  muted={isMuted}
                  loop
                  playsInline
                  preload="metadata"
                  onTimeUpdate={handleTimeUpdate}
                  onError={() => setVideoError(true)}
                  onEnded={() => setIsPlaying(false)}
                >
                  <source src={activeReview.video_url} type="video/mp4" onError={() => setVideoError(true)} />
                </video>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
                  {activeReview?.thumbnail_url ? (
                    <img
                      src={activeReview.thumbnail_url}
                      alt={activeReview.title}
                      className="w-full h-full object-cover opacity-85"
                    />
                  ) : (
                    <div className="text-center font-mono text-slate-500 text-xs">
                      [VFX FRAME VIEWPORT BUFFER: {activeReview?.entity_code || 'SEQUENCE_010'}]
                    </div>
                  )}
                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
                  <div className="absolute bottom-3 left-3 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-indigo-300 border border-indigo-500/30">
                    FRAME BUFFER • {currentFrame.toString().padStart(4, '0')} / {totalFrames.toString().padStart(4, '0')}
                  </div>
                </div>
              )}

              {/* A/B Wipe Overlay Simulator */}
              {isAbWipeActive && (
                <div
                  className="absolute inset-0 border-r-2 border-indigo-400 bg-slate-900/30 backdrop-hue-rotate-60 pointer-events-none overflow-hidden"
                  style={{ width: `${wipePercent}%` }}
                >
                  <div className="absolute top-2 left-2 bg-indigo-600/90 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                    COMP: v001 (Prev)
                  </div>
                </div>
              )}

              {/* Interactive Markup Drawing Canvas */}
              <canvas
                ref={canvasRef}
                width={854}
                height={480}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className={`absolute inset-0 w-full h-full ${
                  activeDrawTool !== 'none' ? 'cursor-crosshair' : 'cursor-default pointer-events-none'
                }`}
              />

              {/* Timecode & Frame Burn-in Overlay */}
              <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center space-x-2">
                <span>TC: {formatTimecode(currentFrame, fps)}</span>
                <span className="text-slate-500">|</span>
                <span>F: {currentFrame}/{totalFrames}</span>
              </div>

              {/* Version & Code Tag */}
              <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-mono text-white border border-slate-700 flex items-center space-x-2">
                <span className="text-indigo-400 font-bold">{activeReview?.entity_code}</span>
                <span>{activeReview?.version_number}</span>
              </div>
            </div>

            {/* Drawing Markup Toolbar */}
            <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mr-1">Markup:</span>
                <button
                  onClick={() => setActiveDrawTool(activeDrawTool === 'pen' ? 'none' : 'pen')}
                  className={`p-1.5 rounded text-xs transition-all ${
                    activeDrawTool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                  title="Freehand Pen"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setActiveDrawTool(activeDrawTool === 'rect' ? 'none' : 'rect')}
                  className={`p-1.5 rounded text-xs transition-all ${
                    activeDrawTool === 'rect' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                  title="Bounding Box"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setActiveDrawTool(activeDrawTool === 'arrow' ? 'none' : 'arrow')}
                  className={`p-1.5 rounded text-xs transition-all ${
                    activeDrawTool === 'arrow' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                  title="Callout Arrow"
                >
                  <MoveUpRight className="w-3.5 h-3.5" />
                </button>

                {/* Color swatches */}
                {activeDrawTool !== 'none' && (
                  <div className="flex items-center space-x-1 ml-2 pl-2 border-l border-slate-800">
                    {['#f59e0b', '#10b981', '#f43f5e', '#38bdf8'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setDrawColor(c)}
                        className={`w-3.5 h-3.5 rounded-full ${drawColor === c ? 'ring-2 ring-white scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={clearCanvas}
                className="p-1 rounded text-slate-400 hover:text-rose-400 text-xs flex items-center gap-1"
                title="Clear Drawing Markup"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline">Clear</span>
              </button>
            </div>

            {/* Scrubber & Timeline Bar */}
            <div className="px-3 pt-2 pb-1 bg-slate-950/60 border-t border-slate-800 space-y-1.5">
              {/* Timeline Slider with Annotation Markers */}
              <div className="relative w-full h-4 flex items-center">
                <input
                  type="range"
                  min={1}
                  max={totalFrames}
                  value={currentFrame}
                  onChange={(e) => seekToFrame(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 z-10"
                />

                {activeReview?.annotations?.map((ann) => {
                  const percent = ((ann.frame_number - 1) / totalFrames) * 100;
                  return (
                    <button
                      key={ann.id}
                      onClick={() => seekToFrame(ann.frame_number)}
                      title={`Frame ${ann.frame_number}: ${ann.comment}`}
                      className="absolute top-0 w-1.5 h-3.5 bg-amber-400 rounded-xs hover:scale-150 transition-transform z-20"
                      style={{ left: `calc(${percent}% - 3px)` }}
                    />
                  );
                })}
              </div>

              {/* Player Controls Toolbar */}
              <div className="flex items-center justify-between text-slate-300 py-1">
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => stepFrame(-1)}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white"
                    title="Previous Frame (Left Arrow)"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => stepFrame(1)}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white"
                    title="Next Frame (Right Arrow)"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => seekToFrame(1)}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
                    title="Reset to Head"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                  <span>{activeReview?.resolution}</span>
                  <span>•</span>
                  <span>{fps} FPS</span>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1 hover:text-white transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Supervisor Decision Verdict Card */}
          <HasRole role={['Platform Admin', 'Organization Admin', 'VFX Supervisor']}>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="py-2.5 px-3.5 flex items-center justify-between border-b border-slate-800">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Supervisor Sign-Off Verdict
                </h4>
                <StatusBadge status={activeReview?.status} />
              </CardHeader>
              <CardBody className="p-3 space-y-2">
                <textarea
                  rows={2}
                  value={supervisorNotes}
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  placeholder="Supervisor review directives for comp/lighting artist..."
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
                />

                <div className="flex items-center justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerdict('Retake')}
                    isLoading={isSubmittingVerdict}
                    className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                    leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
                  >
                    Send for Retake
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleVerdict('Approved')}
                    isLoading={isSubmittingVerdict}
                    className="bg-emerald-600 hover:bg-emerald-500"
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Approve Cut Version
                  </Button>
                </div>
              </CardBody>
            </Card>
          </HasRole>
        </div>

        {/* Right Column: Frame Notes & Directives (3 cols) */}
        <div className="lg:col-span-3 space-y-2 flex flex-col h-full">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Frame Log ({activeReview?.annotations?.length || 0})
            </span>
            <span className="text-[10px] font-mono text-slate-500">Jump to frame</span>
          </div>

          {/* Annotations List */}
          <div className="space-y-1.5 flex-1 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
            {(!activeReview?.annotations || activeReview.annotations.length === 0) ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                No frame annotations on this cut yet. Scrub to any frame and attach a note below.
              </div>
            ) : (
              activeReview.annotations.map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => seekToFrame(ann.frame_number)}
                  className={`p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-indigo-500/40 transition-all cursor-pointer space-y-1 ${
                    currentFrame === ann.frame_number ? 'ring-1 ring-amber-400/80 bg-amber-950/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-bold text-amber-400 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                      Frame {ann.frame_number}
                    </span>
                    <span className="text-slate-400 font-mono">{ann.timecode}</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">{ann.comment}</p>
                  <div className="text-[9px] text-slate-500 pt-0.5 flex justify-between">
                    <span>{ann.author_name}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Frame Note Input */}
          <form onSubmit={handleAddNote} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Attach note to frame:</span>
              <strong className="text-emerald-400">Frame {currentFrame}</strong>
            </div>
            <textarea
              rows={2}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="e.g. Flare falloff on edge is 0.05 too hot..."
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={isAddingAnnotation}
                disabled={!newComment.trim()}
                leftIcon={<Send className="w-3 h-3" />}
              >
                Post Frame Note
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
