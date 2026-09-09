import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { MediaItem, MediaType } from '@/types/media';
import { Button } from '../Button';
import { Badge } from '../Badge';

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
  const resolvedUrl = sourceUrl || media?.source_url || media?.preview_url || thumbnailUrl || media?.thumbnail_url || '';
  const resolvedType = mediaType || media?.media_type || 'video';
  const resolvedColorSpace = colorSpace || media?.color_space || 'ACEScg';
  const resolvedResolution = resolution || media?.resolution || '4K DCI';
  const resolvedFps = fps || media?.fps || 24;
  const totalFrames = endFrame - startFrame + 1;

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

  // Sync current frame with video playback
  useEffect(() => {
    if (onFrameChange) {
      onFrameChange(currentFrame);
    }
  }, [currentFrame, onFrameChange]);

  // Video time update handler
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      const duration = videoRef.current.duration || 1;
      const frameOffset = Math.floor((time / duration) * totalFrames);
      setCurrentFrame(startFrame + Math.min(frameOffset, totalFrames - 1));
    }
  };

  const togglePlay = () => {
    if (resolvedType === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (resolvedType === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (resolvedType === 'sequence') {
      setIsPlaying(!isPlaying);
    }
  };

  // Sequence simulated playback
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && resolvedType === 'sequence') {
      interval = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= endFrame) {
            return isLooping ? startFrame : endFrame;
          }
          return prev + 1;
        });
      }, (1000 / resolvedFps) / playbackSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, resolvedType, endFrame, startFrame, isLooping, resolvedFps, playbackSpeed]);

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

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl ${className}`}
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
          {resolvedType === 'video' && (
            <video
              ref={videoRef}
              src={resolvedUrl}
              poster={thumbnailUrl || media?.thumbnail_url}
              className="max-h-[500px] w-auto object-contain rounded shadow-lg"
              muted={isMuted}
              loop={isLooping}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
              playsInline
            />
          )}

          {resolvedType === 'image' && (
            <img
              src={resolvedUrl}
              alt={title || 'Media Render'}
              className="max-h-[500px] w-auto object-contain rounded shadow-lg"
              loading="lazy"
            />
          )}

          {resolvedType === 'sequence' && (
            <div className="relative">
              <img
                src={resolvedUrl}
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
              <audio
                ref={audioRef}
                src={resolvedUrl}
                muted={isMuted}
                loop={isLooping}
                onEnded={() => setIsPlaying(false)}
              />
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
          <div className="relative flex items-center space-x-2">
            <span className="text-[10px] font-mono text-slate-400 w-10 text-right">{startFrame}</span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={startFrame}
                max={endFrame}
                value={currentFrame}
                onChange={handleScrubberChange}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 w-10">{endFrame}</span>
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
