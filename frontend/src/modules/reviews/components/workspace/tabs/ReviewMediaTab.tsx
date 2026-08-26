import React, { useState, useRef, useEffect } from 'react';
import { ReviewSession, ReviewAnnotation, ReviewVersionRef } from '@/types/reviews';
import { Button } from '@/shared/components/Button';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
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
  Eye,
  Check,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from 'lucide-react';

interface ReviewMediaTabProps {
  review: ReviewSession;
  onAddAnnotation: (annotation: Partial<ReviewAnnotation>) => Promise<any>;
  isAddingAnnotation?: boolean;
}

export const ReviewMediaTab: React.FC<ReviewMediaTabProps> = ({
  review,
  onAddAnnotation,
  isAddingAnnotation,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const compareVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);
  const totalFrames = review.total_frames || 144;
  const fps = review.fps || 24;
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // Drawing tools state
  const [activeDrawTool, setActiveDrawTool] = useState<'none' | 'pen' | 'rect' | 'arrow' | 'circle'>('none');
  const [drawColor, setDrawColor] = useState('#f59e0b');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStartPos, setDrawStartPos] = useState<{ x: number; y: number } | null>(null);
  const [annotationComment, setAnnotationComment] = useState('');
  const [drawnPaths, setDrawnPaths] = useState<any[]>([]);

  // Version Comparison Mode (A/B Wipe & Side-by-Side)
  const [isAbWipeActive, setIsAbWipeActive] = useState(false);
  const [compareMode, setCompareMode] = useState<'wipe' | 'side-by-side' | 'off'>('off');
  const [wipePercent, setWipePercent] = useState(50);
  const [compareVersion, setCompareVersion] = useState<ReviewVersionRef | null>(
    review.versions && review.versions.length > 1 ? review.versions[1] : null
  );

  // Color & LUT Pipeline
  const [lutProfile, setLutProfile] = useState<'aces' | 'rec709' | 'srgb' | 'logc'>('aces');
  const [exposureVal, setExposureVal] = useState(0); // -2 to +2
  const [gammaVal, setGammaVal] = useState(1.0); // 0.5 to 2.0
  const [channelSolo, setChannelSolo] = useState<'rgb' | 'r' | 'g' | 'b' | 'a'>('rgb');
  const [showColorControls, setShowColorControls] = useState(false);

  // In / Out markers
  const [inFrame, setInFrame] = useState(1);
  const [outFrame, setOutFrame] = useState(totalFrames);

  // Frame timer simulation fallback if video fails to load or for smooth scrubbing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && (!videoRef.current || videoError)) {
      interval = setInterval(() => {
        setCurrentFrame((prev) => (prev >= outFrame ? inFrame : prev + 1));
      }, 1000 / fps);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, videoError, outFrame, inFrame, fps]);

  // Sync canvas size with video container
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        redrawCanvas();
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawnPaths]);

  const togglePlay = () => {
    if (videoRef.current && !videoError && review.video_url) {
      if (isPlaying) {
        try {
          videoRef.current.pause();
          if (compareVideoRef.current) compareVideoRef.current.pause();
        } catch {}
        setIsPlaying(false);
      } else {
        videoRef.current
          .play()
          .then(() => {
            if (compareVideoRef.current) compareVideoRef.current.play();
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
      if (compareVideoRef.current) {
        compareVideoRef.current.currentTime = time;
      }
    } catch {}
  };

  const seekToFrame = (frameNum: number) => {
    const targetFrame = Math.max(1, Math.min(totalFrames, frameNum));
    setCurrentFrame(targetFrame);
    if (videoRef.current && !videoError) {
      try {
        const time = (targetFrame - 1) / fps;
        videoRef.current.currentTime = time;
        if (compareVideoRef.current) compareVideoRef.current.currentTime = time;
      } catch {}
    }
  };

  const stepFrame = (delta: number) => {
    setIsPlaying(false);
    if (videoRef.current && !videoError) {
      try {
        videoRef.current.pause();
        if (compareVideoRef.current) compareVideoRef.current.pause();
      } catch {}
    }
    seekToFrame(currentFrame + delta);
  };

  // Convert frame number to SMPTE timecode (HH:MM:SS:FF)
  const formatSMPTETimecode = (frame: number): string => {
    const totalSeconds = Math.floor((frame - 1) / fps);
    const ff = ((frame - 1) % fps).toString().padStart(2, '0');
    const ss = (totalSeconds % 60).toString().padStart(2, '0');
    const mm = (Math.floor(totalSeconds / 60) % 60).toString().padStart(2, '0');
    const hh = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}:${ff}`;
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDrawTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setDrawStartPos({ x, y });

    if (activeDrawTool === 'pen') {
      setDrawnPaths((prev) => [
        ...prev,
        {
          tool: 'pen',
          color: drawColor,
          width: lineWidth,
          points: [{ x, y }],
          frame: currentFrame,
        },
      ]);
    }
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeDrawTool === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeDrawTool === 'pen') {
      setDrawnPaths((prev) => {
        const last = { ...prev[prev.length - 1] };
        last.points = [...last.points, { x, y }];
        return [...prev.slice(0, -1), last];
      });
    } else {
      redrawCanvas();
      const ctx = canvas.getContext('2d');
      if (ctx && drawStartPos) {
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = lineWidth;
        if (activeDrawTool === 'rect') {
          ctx.strokeRect(drawStartPos.x, drawStartPos.y, x - drawStartPos.x, y - drawStartPos.y);
        } else if (activeDrawTool === 'circle') {
          ctx.beginPath();
          const radius = Math.hypot(x - drawStartPos.x, y - drawStartPos.y);
          ctx.arc(drawStartPos.x, drawStartPos.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (activeDrawTool === 'arrow') {
          drawArrow(ctx, drawStartPos.x, drawStartPos.y, x, y);
        }
      }
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeDrawTool === 'none') return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas || !drawStartPos) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeDrawTool !== 'pen') {
      setDrawnPaths((prev) => [
        ...prev,
        {
          tool: activeDrawTool,
          color: drawColor,
          width: lineWidth,
          start: drawStartPos,
          end: { x, y },
          frame: currentFrame,
        },
      ]);
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromx: number, fromy: number, tox: number, toy: number) => {
    const headlen = 12;
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawnPaths
      .filter((p) => p.frame === currentFrame)
      .forEach((path) => {
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (path.tool === 'pen') {
          ctx.beginPath();
          path.points.forEach((pt: { x: number; y: number }, idx: number) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
        } else if (path.tool === 'rect') {
          ctx.strokeRect(path.start.x, path.start.y, path.end.x - path.start.x, path.end.y - path.start.y);
        } else if (path.tool === 'circle') {
          ctx.beginPath();
          const radius = Math.hypot(path.end.x - path.start.x, path.end.y - path.start.y);
          ctx.arc(path.start.x, path.start.y, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (path.tool === 'arrow') {
          drawArrow(ctx, path.start.x, path.start.y, path.end.x, path.end.y);
        }
      });
  };

  useEffect(() => {
    redrawCanvas();
  }, [currentFrame, drawnPaths]);

  const clearCanvas = () => {
    setDrawnPaths((prev) => prev.filter((p) => p.frame !== currentFrame));
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSaveAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotationComment.trim() && drawnPaths.length === 0) return;
    await onAddAnnotation({
      frame_number: currentFrame,
      timecode: formatSMPTETimecode(currentFrame),
      comment: annotationComment.trim() || 'Visual markup attached.',
      drawing_coordinates: drawnPaths.filter((p) => p.frame === currentFrame),
    });
    setAnnotationComment('');
    setActiveDrawTool('none');
  };

  // Color Filter CSS Calculation
  const getFilterStyle = () => {
    let brightness = 100 + exposureVal * 30;
    let contrast = 100;
    let saturate = 100;

    if (lutProfile === 'rec709') {
      contrast = 110;
      saturate = 105;
    } else if (lutProfile === 'logc') {
      contrast = 70;
      brightness += 10;
      saturate = 80;
    }

    let filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
    if (channelSolo === 'r') filter += ' grayscale(100%) sepia(100%) hue-rotate(-50deg)';
    if (channelSolo === 'g') filter += ' grayscale(100%) sepia(100%) hue-rotate(80deg)';
    if (channelSolo === 'b') filter += ' grayscale(100%) sepia(100%) hue-rotate(190deg)';
    if (channelSolo === 'a') filter += ' grayscale(100%)';

    return filter;
  };

  return (
    <div id="review-media-tab" className="p-4 space-y-4 max-w-7xl mx-auto flex flex-col h-full">
      {/* Top Media Control & Pipeline Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
        {/* Drawing Tools Palette */}
        <div className="flex items-center space-x-1">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mr-1.5">
            Markup:
          </span>
          <button
            onClick={() => setActiveDrawTool(activeDrawTool === 'pen' ? 'none' : 'pen')}
            className={`p-1.5 rounded-lg border transition-colors ${
              activeDrawTool === 'pen'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
            title="Brush Pen"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveDrawTool(activeDrawTool === 'rect' ? 'none' : 'rect')}
            className={`p-1.5 rounded-lg border transition-colors ${
              activeDrawTool === 'rect'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
            title="Rectangle Box"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveDrawTool(activeDrawTool === 'circle' ? 'none' : 'circle')}
            className={`p-1.5 rounded-lg border transition-colors ${
              activeDrawTool === 'circle'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
            title="Circle"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveDrawTool(activeDrawTool === 'arrow' ? 'none' : 'arrow')}
            className={`p-1.5 rounded-lg border transition-colors ${
              activeDrawTool === 'arrow'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
            title="Arrow Directive"
          >
            <MoveUpRight className="w-4 h-4" />
          </button>

          {activeDrawTool !== 'none' && (
            <div className="flex items-center space-x-1.5 pl-2 ml-1 border-l border-slate-800">
              {['#f59e0b', '#ef4444', '#06b6d4', '#10b981', '#ffffff'].map((c) => (
                <button
                  key={c}
                  onClick={() => setDrawColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded-full transition-transform ${
                    drawColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
              <button
                onClick={clearCanvas}
                className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                title="Clear current frame drawings"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Version Comparison & Wipe Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => {
                setCompareMode(compareMode === 'wipe' ? 'off' : 'wipe');
                setIsAbWipeActive(compareMode !== 'wipe');
              }}
              className={`px-2 py-1 rounded font-mono font-medium transition-colors flex items-center gap-1.5 ${
                compareMode === 'wipe'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              A/B Wipe
            </button>
            <button
              onClick={() => {
                setCompareMode(compareMode === 'side-by-side' ? 'off' : 'side-by-side');
                setIsAbWipeActive(false);
              }}
              className={`px-2 py-1 rounded font-mono font-medium transition-colors flex items-center gap-1.5 ${
                compareMode === 'side-by-side'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Side-by-Side
            </button>
          </div>

          {compareMode !== 'off' && review.versions && review.versions.length > 1 && (
            <select
              value={compareVersion?.id || ''}
              onChange={(e) => {
                const found = review.versions?.find((v) => v.id === e.target.value);
                if (found) setCompareVersion(found);
              }}
              className="bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-2 py-1 font-mono focus:ring-1 focus:ring-indigo-500"
            >
              {review.versions
                .filter((v) => v.version_number !== review.version_number)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    Compare: {v.version_number} ({v.artist_name})
                  </option>
                ))}
            </select>
          )}

          {/* Color & LUT Settings Toggle */}
          <button
            onClick={() => setShowColorControls(!showColorControls)}
            className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 transition-colors ${
              showColorControls
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
            title="LUT & Grade Viewer Controls"
          >
            <Sliders className="w-4 h-4" />
            <span className="uppercase text-[11px] font-bold">{lutProfile}</span>
          </button>
        </div>
      </div>

      {/* Optional Color & LUT Drawer */}
      {showColorControls && (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Color Profile / LUT</label>
            <select
              value={lutProfile}
              onChange={(e) => setLutProfile(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-white font-mono text-xs"
            >
              <option value="aces">ACEScg (AP1)</option>
              <option value="rec709">Rec.709 Standard</option>
              <option value="srgb">sRGB Display</option>
              <option value="logc">ARRI LogC Raw</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>Exposure (EV)</span>
              <span className="text-white font-bold">{exposureVal > 0 ? `+${exposureVal}` : exposureVal} EV</span>
            </div>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.25"
              value={exposureVal}
              onChange={(e) => setExposureVal(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>Gamma Display</span>
              <span className="text-white font-bold">{gammaVal.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={gammaVal}
              onChange={(e) => setGammaVal(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">Channel Solo</label>
            <div className="flex space-x-1">
              {(['rgb', 'r', 'g', 'b', 'a'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelSolo(ch)}
                  className={`flex-1 py-1 rounded uppercase font-mono text-[10px] font-bold border transition-colors ${
                    channelSolo === ch
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video / Canvas Viewport Container */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[380px] bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center select-none group"
      >
        {/* Main Current Version Video Player */}
        <div
          className="relative w-full h-full flex items-center justify-center overflow-hidden"
          style={{ filter: getFilterStyle() }}
        >
          {compareMode === 'side-by-side' ? (
            <div className="grid grid-cols-2 w-full h-full gap-1">
              {/* Version A */}
              <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                <video
                  ref={videoRef}
                  src={review.video_url}
                  poster={review.thumbnail_url}
                  muted={isMuted}
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 border border-slate-700 rounded font-mono text-[10px] text-emerald-400">
                  Current: {review.version_number}
                </div>
              </div>
              {/* Version B */}
              <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                <video
                  ref={compareVideoRef}
                  src={compareVersion?.video_url || review.video_url}
                  poster={compareVersion?.thumbnail_url || review.thumbnail_url}
                  muted={true}
                  playsInline
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 border border-slate-700 rounded font-mono text-[10px] text-cyan-400">
                  Compare: {compareVersion?.version_number || 'Previous'}
                </div>
              </div>
            </div>
          ) : compareMode === 'wipe' && isAbWipeActive ? (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Background: Compare Version B */}
              <video
                ref={compareVideoRef}
                src={compareVersion?.video_url || review.video_url}
                poster={compareVersion?.thumbnail_url || review.thumbnail_url}
                muted={true}
                playsInline
                className="absolute inset-0 w-full h-full object-contain"
              />

              {/* Foreground: Current Version A (clipped by wipePercent) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${wipePercent}%` }}
              >
                <video
                  ref={videoRef}
                  src={review.video_url}
                  poster={review.thumbnail_url}
                  muted={isMuted}
                  playsInline
                  onTimeUpdate={handleTimeUpdate}
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ width: `${100 / (wipePercent / 100)}%`, maxWidth: 'none' }}
                />
              </div>

              {/* Wipe Vertical Splitter Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-lg cursor-ew-resize z-20"
                style={{ left: `${wipePercent}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -left-3.5 bg-amber-400 text-slate-950 p-1 rounded-full text-[9px] font-bold shadow-md">
                  A|B
                </div>
              </div>

              {/* Wipe Range Drag Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={wipePercent}
                onChange={(e) => setWipePercent(Number(e.target.value))}
                className="absolute bottom-4 left-1/4 right-1/4 z-30 opacity-70 hover:opacity-100 accent-amber-400"
              />
            </div>
          ) : (
            /* Single Primary Stream */
            <video
              ref={videoRef}
              src={review.video_url}
              poster={review.thumbnail_url}
              muted={isMuted}
              playsInline
              onTimeUpdate={handleTimeUpdate}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        {/* Drawing / Annotation HTML5 Canvas Overlay */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={drawMove}
          onMouseUp={stopDrawing}
          className={`absolute inset-0 z-10 w-full h-full ${
            activeDrawTool !== 'none' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
          }`}
        />

        {/* Floating Timecode HUD Overlay */}
        <div className="absolute top-3 right-3 z-20 flex items-center space-x-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono font-bold shadow-lg">
          <span className="text-amber-400">{formatSMPTETimecode(currentFrame)}</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400">FR {currentFrame}</span>
          <span className="text-slate-500">/ {totalFrames}</span>
        </div>
      </div>

      {/* Scrub Bar & Frame Timeline Controls */}
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2.5">
        {/* Timeline Range Slider with Marker Indicators */}
        <div className="relative flex items-center">
          <input
            type="range"
            min="1"
            max={totalFrames}
            value={currentFrame}
            onChange={(e) => seekToFrame(Number(e.target.value))}
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
          />

          {/* Annotation Frame Dots */}
          {review.annotations?.map((ann) => {
            const posPct = ((ann.frame_number - 1) / (totalFrames - 1)) * 100;
            return (
              <button
                key={ann.id}
                onClick={() => seekToFrame(ann.frame_number)}
                title={`Annotation on Frame ${ann.frame_number}: ${ann.comment}`}
                style={{ left: `${posPct}%` }}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950 hover:scale-150 transition-transform z-10"
              />
            );
          })}
        </div>

        {/* Playback Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => stepFrame(-10)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-mono text-xs"
              title="Step -10 Frames"
            >
              -10
            </button>
            <button
              onClick={() => stepFrame(-1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Step Back 1 Frame (Left Arrow)"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-md"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Step Forward 1 Frame (Right Arrow)"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              onClick={() => stepFrame(10)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-mono text-xs"
              title="Step +10 Frames"
            >
              +10
            </button>
            <button
              onClick={() => seekToFrame(1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1"
              title="Jump to Head (Frame 1)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time & Frame Input Box */}
          <div className="flex items-center space-x-2 font-mono text-xs">
            <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400">Frame:</span>
              <input
                type="number"
                min="1"
                max={totalFrames}
                value={currentFrame}
                onChange={(e) => seekToFrame(Number(e.target.value))}
                className="w-14 bg-transparent text-emerald-400 font-bold focus:outline-none text-right"
              />
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{totalFrames}</span>
            </div>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Frame Annotation Submission Card */}
      <form
        onSubmit={handleSaveAnnotation}
        className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center space-x-3"
      >
        <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-mono font-bold whitespace-nowrap">
          Frame {currentFrame}
        </div>
        <input
          type="text"
          value={annotationComment}
          onChange={(e) => setAnnotationComment(e.target.value)}
          placeholder={`Add visual directive / note for Frame ${currentFrame}...`}
          className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
        />
        <Button
          variant="primary"
          size="sm"
          type="submit"
          isLoading={isAddingAnnotation}
          disabled={!annotationComment.trim() && drawnPaths.length === 0}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap"
          leftIcon={<Send className="w-3.5 h-3.5" />}
        >
          Save Frame Markup
        </Button>
      </form>
    </div>
  );
};
