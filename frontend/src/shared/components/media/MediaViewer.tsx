import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Eye,
  Film,
  Music,
  Image as ImageIcon,
  SkipBack,
  SkipForward,
  Repeat,
  Tv,
  Layers,
  Sparkles,
  Info,
  AlertCircle,
} from 'lucide-react';
import type { MediaItem, MediaType } from '@/types/production';
import { Button } from '../Button';
import { Badge } from '../Badge';
import {
  inferMediaType,
  isImageUrl,
  resolveSafeVideoUrl,
  DEFAULT_FALLBACK_VIDEO_URL,
  DEFAULT_FALLBACK_THUMBNAIL_URL,
} from '@/shared/utils/mediaUtils';

interface MediaViewerProps {
  media?: Partial<MediaItem> | null;
  title?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  mediaType?: MediaType;
  colorSpace?: string;
  resolution?: string;
  fps?: number;
  startFrame?: number;
  endFrame?: number;
  onFrameChange?: (frame: number) => void;
  className?: string;
  showControls?: boolean;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  media,
  title,
  sourceUrl,
  thumbnailUrl,
  mediaType = 'video',
  colorSpace = 'ACEScg',
  resolution = '4096x2160',
  fps = 24,
  startFrame = 1001,
  endFrame = 1086,
  onFrameChange,
  className = '',
  showControls = true,
}) => {
  const rawUrl = sourceUrl || media?.source_url || media?.preview_url || thumbnailUrl || media?.thumbnail_url || '';
  const initialType = mediaType || media?.media_type || 'video';
  const inferredType = inferMediaType(rawUrl, initialType);
  const resolvedType = inferredType;
  const resolvedColorSpace = colorSpace || media?.color_space || 'ACEScg';
  const resolvedResolution = resolution || media?.resolution || '4K DCI';
  const resolvedFps = fps || media?.fps || 24;
  const totalFrames = endFrame - startFrame + 1;

  const [hasVideoError, setHasVideoError] = useState(false);
  const [hasAudioError, setHasAudioError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(startFrame);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [showSafeGuides, setShowSafeGuides] = useState(false);
  const [showHud, setShowHud] = useState(true);
  const [channelMode, setChannelMode] = useState<'RGB' | 'R' | 'G' | 'B' | 'A'>('RGB');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const effectiveVideoUrl = resolveSafeVideoUrl(
    sourceUrl || media?.source_url || media?.preview_url,
    DEFAULT_FALLBACK_VIDEO_URL
  );
  const effectiveImageUrl =
    thumbnailUrl || media?.thumbnail_url || (isImageUrl(rawUrl) ? rawUrl : DEFAULT_FALLBACK_THUMBNAIL_URL);

  // Sync current frame with video playback
  useEffect(() => {
    if (onFrameChange) {
      onFrameChange(currentFrame);
    }
  }, [currentFrame, onFrameChange]);

  // Reset video error on source change
  useEffect(() => {
    setHasVideoError(false);
    setHasAudioError(false);
  }, [effectiveVideoUrl, rawUrl]);

  // Unified Playback Engine (Runs whenever isPlaying is true)
  useEffect(() => {
    if (!isPlaying) return;

    const frameIntervalMs = (1000 / resolvedFps) / playbackSpeed;
    const interval = setInterval(() => {
      // If HTML5 video is actively playing and has valid duration, sync from video time
      if (videoRef.current && !hasVideoError && Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0 && !videoRef.current.paused) {
        const time = videoRef.current.currentTime;
        const duration = videoRef.current.duration;
        const progress = Math.max(0, Math.min(1, time / duration));
        const frameOffset = Math.floor(progress * totalFrames);
        const nextFrame = startFrame + Math.min(frameOffset, totalFrames - 1);
        setCurrentFrame(nextFrame);
      } else {
        // Master frame ticker for sequences, images, or simulated stream playback
        setCurrentFrame((prev) => {
          const next = prev + 1;
          if (next > endFrame) {
            if (isLooping) {
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
              }
              return startFrame;
            } else {
              setIsPlaying(false);
              return endFrame;
            }
          }
          return next;
        });
      }
    }, frameIntervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, resolvedFps, playbackSpeed, isLooping, startFrame, endFrame, totalFrames, hasVideoError]);

  // Video time update handler
  const handleTimeUpdate = () => {
    if (videoRef.current && Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
      const time = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      const progress = Math.max(0, Math.min(1, time / duration));
      const frameOffset = Math.floor(progress * totalFrames);
      setCurrentFrame(startFrame + Math.min(frameOffset, totalFrames - 1));
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {}
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {}
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      // Attempt HTML5 video play if available
      if (videoRef.current && !hasVideoError) {
        videoRef.current.play().catch(() => {
          // If unmuted playback was blocked by browser policy, retry muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {
              // Gracefully continue with frame ticker
            });
          }
        });
      }
      // Attempt HTML5 audio play if available
      if (audioRef.current && !hasAudioError) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const stepFrame = (delta: number) => {
    if (isPlaying) {
      if (videoRef.current) videoRef.current.pause();
      setIsPlaying(false);
    }
    const nextFrame = Math.max(startFrame, Math.min(endFrame, currentFrame + delta));
    setCurrentFrame(nextFrame);
    if (videoRef.current && videoRef.current.duration) {
      const ratio = (nextFrame - startFrame) / totalFrames;
      videoRef.current.currentTime = ratio * videoRef.current.duration;
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value, 10);
    setCurrentFrame(frame);
    if (videoRef.current && videoRef.current.duration) {
      const ratio = (frame - startFrame) / totalFrames;
      videoRef.current.currentTime = ratio * videoRef.current.duration;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // Calculate timecode string from frame
  const formatTimecode = (frame: number, frameRate: number) => {
    const totalSeconds = Math.floor(frame / frameRate);
    const ff = String(frame % frameRate).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    const mm = String(Math.floor(totalSeconds / 60) % 60).padStart(2, '0');
    const hh = String(Math.floor(totalSeconds / 3600) + 1).padStart(2, '0');
    return `${hh}:${mm}:${ss}:${ff}`;
  };

  const getChannelFilterStyle = () => {
    switch (channelMode) {
      case 'R':
        return 'contrast(120%) grayscale(100%) sepia(100%) hue-rotate(-50deg) saturate(600%)';
      case 'G':
        return 'contrast(120%) grayscale(100%) sepia(100%) hue-rotate(80deg) saturate(600%)';
      case 'B':
        return 'contrast(120%) grayscale(100%) sepia(100%) hue-rotate(190deg) saturate(600%)';
      case 'A':
        return 'grayscale(100%) contrast(200%)';
      default:
        return 'none';
    }
  };

  const progressPercent = Math.max(
    0,
    Math.min(100, (((currentFrame || startFrame) - startFrame) / Math.max(1, totalFrames - 1)) * 100)
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepFrame(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepFrame(1);
        }
      }}
      className={`relative flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${className}`}
    >
      {/* Top Media Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 backdrop-blur border-b border-slate-800/80 z-20">
        <div className="flex items-center space-x-3 truncate">
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-medium uppercase tracking-wider">
            {resolvedType === 'video' && <Film className="w-3 h-3 mr-1" />}
            {resolvedType === 'audio' && <Music className="w-3 h-3 mr-1" />}
            {resolvedType === 'image' && <ImageIcon className="w-3 h-3 mr-1" />}
            {resolvedType === 'sequence' && <Layers className="w-3 h-3 mr-1" />}
            {resolvedType}
          </div>
          <span className="text-xs font-semibold text-slate-200 truncate font-mono">
            {title || media?.name || 'Studio Viewport Render'}
          </span>
          <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
            {resolvedColorSpace}
          </Badge>
        </div>

        <div className="flex items-center space-x-1">
          {/* Channel Isolation */}
          <div className="hidden sm:flex items-center bg-slate-800/80 rounded p-0.5 border border-slate-700/60 mr-2">
            {(['RGB', 'R', 'G', 'B', 'A'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setChannelMode(mode)}
                className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-colors ${
                  channelMode === mode
                    ? mode === 'R'
                      ? 'bg-red-500 text-white'
                      : mode === 'G'
                      ? 'bg-green-500 text-slate-950'
                      : mode === 'B'
                      ? 'bg-blue-500 text-white'
                      : mode === 'A'
                      ? 'bg-slate-200 text-slate-950'
                      : 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
                title={`Isolate ${mode} channel`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Safe Guides Toggle */}
          <button
            onClick={() => setShowSafeGuides(!showSafeGuides)}
            className={`p-1.5 rounded text-xs transition-colors ${
              showSafeGuides ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Framing & Safe Action Guides"
          >
            <Tv className="w-3.5 h-3.5" />
          </button>

          {/* HUD Overlay Toggle */}
          <button
            onClick={() => setShowHud(!showHud)}
            className={`p-1.5 rounded text-xs transition-colors ${
              showHud ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Viewport HUD Overlay"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-0.5 bg-slate-800/80 rounded border border-slate-700/60 p-0.5">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-300 px-1">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="px-1 text-[9px] font-mono text-slate-400 hover:text-white"
              title="Reset 100%"
            >
              1:1
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
            title="Toggle Fullscreen Viewport"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div className="relative flex-1 min-h-[320px] max-h-[600px] bg-slate-950 flex items-center justify-center overflow-hidden select-none">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

        {/* Viewport Content Container */}
        <div
          className="relative transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full"
          style={{
            transform: `scale(${zoomLevel})`,
            filter: getChannelFilterStyle(),
          }}
        >
          {resolvedType === 'video' && !hasVideoError && (
            <video
              ref={videoRef}
              poster={effectiveImageUrl}
              className="max-h-[500px] w-auto object-contain rounded shadow-lg"
              muted={isMuted}
              loop={isLooping}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
              onError={() => setHasVideoError(true)}
              playsInline
            >
              <source
                src={effectiveVideoUrl}
                type="video/mp4"
                onError={() => setHasVideoError(true)}
              />
            </video>
          )}

          {(resolvedType === 'image' || (resolvedType === 'video' && hasVideoError)) && (
            <div className="relative flex items-center justify-center">
              <img
                src={effectiveImageUrl}
                alt={title || 'Media Render'}
                className="max-h-[500px] w-auto object-contain rounded shadow-lg"
                loading="lazy"
              />
              {hasVideoError && (
                <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-slate-300 flex items-center space-x-1.5 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span>Master Reference Frame</span>
                </div>
              )}
            </div>
          )}

          {resolvedType === 'sequence' && (
            <div className="relative">
              <img
                src={effectiveImageUrl}
                alt={`Sequence frame ${currentFrame}`}
                className="max-h-[500px] w-auto object-contain rounded shadow-lg"
              />
              <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-[11px] font-mono text-cyan-400 border border-cyan-500/30">
                Frame {currentFrame} / {endFrame}
              </div>
            </div>
          )}

          {resolvedType === 'audio' && (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              {!hasAudioError && (
                <audio
                  ref={audioRef}
                  muted={isMuted}
                  loop={isLooping}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => setHasAudioError(true)}
                >
                  <source src={rawUrl || effectiveVideoUrl} onError={() => setHasAudioError(true)} />
                </audio>
              )}
              <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl animate-pulse">
                <Music className="w-10 h-10" />
              </div>
              {/* Simulated Audio Spectrum Visualizer */}
              <div className="flex items-end space-x-1 h-16 px-6 py-2 bg-slate-900/80 rounded-lg border border-slate-800">
                {[40, 65, 80, 50, 90, 75, 45, 85, 95, 60, 70, 55, 30, 85, 60, 45].map((val, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 rounded-t transition-all duration-150 ${
                      isPlaying ? 'bg-gradient-to-t from-blue-500 to-indigo-400' : 'bg-slate-700'
                    }`}
                    style={{
                      height: isPlaying ? `${Math.max(10, Math.min(100, val * (0.6 + Math.sin(idx + Date.now() * 0.005) * 0.4)))}%` : '15%',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-slate-400">
                {media?.audio_channels || '5.1 Surround'} • 24-bit 48kHz Broadcast WAV
              </span>
            </div>
          )}
        </div>

        {/* Safe Guides Overlay */}
        {showSafeGuides && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* 16:9 Action Safe (90%) */}
            <div className="absolute w-[90%] h-[90%] border border-amber-400/40 border-dashed rounded flex flex-col justify-between p-1">
              <span className="text-[9px] font-mono text-amber-400/80 uppercase">90% Action Safe</span>
              <span className="text-[9px] font-mono text-amber-400/80 uppercase self-end">16:9 Broadcast</span>
            </div>
            {/* 2.39:1 Anamorphic Scope Mask */}
            <div className="absolute w-full h-[75%] border-y border-cyan-400/50 flex items-center justify-between px-2">
              <span className="text-[9px] font-mono text-cyan-400/80">2.39:1 Scope Top</span>
              <span className="text-[9px] font-mono text-cyan-400/80">2.39:1 Scope Bottom</span>
            </div>
            {/* Center Crosshair */}
            <div className="absolute w-6 h-6 border-t border-l border-amber-400/60" />
            <div className="absolute w-6 h-6 border-b border-r border-amber-400/60" />
          </div>
        )}

        {/* HUD Metadata Overlay */}
        {showHud && (
          <div className="absolute top-3 left-3 pointer-events-none flex flex-col space-y-1 bg-slate-950/80 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 shadow-xl">
            <div className="flex items-center space-x-2 text-white font-bold">
              <span className="text-cyan-400">{formatTimecode(currentFrame, resolvedFps)}</span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-400 font-semibold">F:{currentFrame}</span>
            </div>
            <div className="text-slate-400 text-[10px]">
              {resolvedResolution} • {resolvedFps} fps
            </div>
            <div className="text-slate-400 text-[10px]">
              Color: <span className="text-slate-200">{resolvedColorSpace}</span>
            </div>
          </div>
        )}
      </div>

      {/* Scrubber & Playback Controls Bar */}
      {showControls && (
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800/80 space-y-2 z-10">
          {/* Timeline Scrubber */}
          <div className="relative flex items-center space-x-2.5">
            <span className="text-[10px] font-mono text-slate-400 w-10 text-right select-none">{startFrame}</span>
            <div className="relative flex-1 flex items-center h-6 group">
              {/* Background Track */}
              <div className="absolute inset-x-0 h-2 bg-slate-800 rounded-lg overflow-hidden border border-slate-700/50">
                {/* Visual Progress Fill */}
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Scrubber Input */}
              <input
                type="range"
                min={startFrame}
                max={endFrame}
                value={isNaN(currentFrame) ? startFrame : currentFrame}
                onChange={handleScrubberChange}
                className="relative z-10 w-full h-4 opacity-0 cursor-pointer"
              />

              {/* Playhead Indicator Handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md pointer-events-none group-hover:scale-125 transition-transform"
                style={{ left: `calc(${progressPercent}% - 8px)` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 w-10 select-none">{endFrame}</span>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-1">
              {/* Step -10 */}
              <button
                onClick={() => stepFrame(-10)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Step Back 10 Frames"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Step -1 */}
              <button
                onClick={() => stepFrame(-1)}
                className="px-2 py-1 rounded text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Step -1 Frame (Key: [)"
              >
                -1
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="p-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-transform active:scale-95"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              {/* Step +1 */}
              <button
                onClick={() => stepFrame(1)}
                className="px-2 py-1 rounded text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Step +1 Frame (Key: ])"
              >
                +1
              </button>

              {/* Step +10 */}
              <button
                onClick={() => stepFrame(10)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Step Forward 10 Frames"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Loop Toggle */}
              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-1.5 rounded transition-colors ml-2 ${
                  isLooping ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
                title="Toggle Looping"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Frame readout & Speed selection */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 font-mono text-xs">
                <span className="text-slate-400">FRAME:</span>
                <span className="text-cyan-400 font-bold">{currentFrame}</span>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400">{endFrame}</span>
              </div>

              {/* Playback speed selector */}
              <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700/60">
                {[0.5, 1, 2].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      setPlaybackSpeed(spd);
                      if (videoRef.current) videoRef.current.playbackRate = spd;
                    }}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                      playbackSpeed === spd ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Mute toggle */}
              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (videoRef.current) videoRef.current.muted = !isMuted;
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
