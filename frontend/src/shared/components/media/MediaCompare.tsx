import type React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Columns,
  SplitSquareVertical,
  Layers,
  Sparkles,
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Repeat,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Eye,
  CheckCircle2,
  Film,
  Zap,
} from 'lucide-react';
import type { ProductionVersion } from '@/types/production';
import type { MediaItem } from '@/types/production';
import { Button } from '../Button';
import { Badge } from '../Badge';
import {
  resolveSafeVideoUrl,
  isImageUrl,
  DEFAULT_FALLBACK_VIDEO_URL,
  DEFAULT_FALLBACK_THUMBNAIL_URL,
} from '@/shared/utils/mediaUtils';

interface MediaCompareProps {
  versionA?: Partial<ProductionVersion> | Partial<MediaItem>;
  versionB?: Partial<ProductionVersion> | Partial<MediaItem>;
  allVersions?: (ProductionVersion | MediaItem)[];
  onSelectVersionA?: (ver: any) => void;
  onSelectVersionB?: (ver: any) => void;
  className?: string;
}

export type CompareMode = 'split' | 'side-by-side' | 'difference' | 'onion-skin' | 'toggle';

export const MediaCompare: React.FC<MediaCompareProps> = ({
  versionA: propVersionA,
  versionB: propVersionB,
  allVersions = [],
  onSelectVersionA,
  onSelectVersionB,
  className = '',
}) => {
  // Local state fallbacks for version selection
  const [internalVersionA, setInternalVersionA] = useState<any>(propVersionA || allVersions[0] || null);
  const [internalVersionB, setInternalVersionB] = useState<any>(
    propVersionB || allVersions[1] || allVersions[0] || null
  );

  // Synchronize when incoming props change
  useEffect(() => {
    if (propVersionA) {
      setInternalVersionA(propVersionA);
    } else if (allVersions.length > 0 && !internalVersionA) {
      setInternalVersionA(allVersions[0]);
    }
  }, [propVersionA, allVersions]);

  useEffect(() => {
    if (propVersionB) {
      setInternalVersionB(propVersionB);
    } else if (allVersions.length > 1 && !internalVersionB) {
      setInternalVersionB(allVersions[1]);
    }
  }, [propVersionB, allVersions]);

  const [mode, setMode] = useState<CompareMode>('split');
  const [splitPos, setSplitPos] = useState<number>(50); // 0 to 100 percentage
  const [onionOpacity, setOnionOpacity] = useState<number>(50); // 0 to 100 percentage
  const [diffGain, setDiffGain] = useState<number>(1); // 1x, 2x, 4x difference multiplier
  const [toggleActiveA, setToggleActiveA] = useState<boolean>(true); // For toggle/flicker mode
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [hasVideoAError, setHasVideoAError] = useState<boolean>(false);
  const [hasVideoBError, setHasVideoBError] = useState<boolean>(false);

  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSplit = useRef<boolean>(false);

  const rawActiveA: any = isSwapped ? internalVersionB : internalVersionA;
  const rawActiveB: any = isSwapped ? internalVersionA : internalVersionB;

  const startFrame = rawActiveA?.frame_in || rawActiveB?.frame_in || 1001;
  const endFrame = rawActiveA?.frame_out || rawActiveB?.frame_out || (startFrame + 85);
  const totalFrames = Math.max(1, endFrame - startFrame + 1);
  const fps = rawActiveA?.fps || rawActiveB?.fps || 24;

  const [currentFrame, setCurrentFrame] = useState<number>(startFrame);

  // Media URLs
  const videoUrlA = resolveSafeVideoUrl(
    rawActiveA?.video_url || rawActiveA?.preview_url || rawActiveA?.source_url,
    DEFAULT_FALLBACK_VIDEO_URL
  );
  const posterUrlA =
    rawActiveA?.thumbnail_url ||
    (isImageUrl(rawActiveA?.video_url) ? rawActiveA.video_url : '') ||
    (isImageUrl(rawActiveA?.preview_url) ? rawActiveA.preview_url : '') ||
    DEFAULT_FALLBACK_THUMBNAIL_URL;

  const videoUrlB = resolveSafeVideoUrl(
    rawActiveB?.video_url || rawActiveB?.preview_url || rawActiveB?.source_url,
    DEFAULT_FALLBACK_VIDEO_URL
  );
  const posterUrlB =
    rawActiveB?.thumbnail_url ||
    (isImageUrl(rawActiveB?.video_url) ? rawActiveB.video_url : '') ||
    (isImageUrl(rawActiveB?.preview_url) ? rawActiveB.preview_url : '') ||
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800';

  const labelA = rawActiveA?.version_number || rawActiveA?.code || rawActiveA?.name || 'Version A';
  const labelB = rawActiveB?.version_number || rawActiveB?.code || rawActiveB?.name || 'Version B';

  // Selection handlers
  const handleSelectA = (ver: any) => {
    setInternalVersionA(ver);
    setHasVideoAError(false);
    if (onSelectVersionA) onSelectVersionA(ver);
  };

  const handleSelectB = (ver: any) => {
    setInternalVersionB(ver);
    setHasVideoBError(false);
    if (onSelectVersionB) onSelectVersionB(ver);
  };

  // Synchronized Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = (1000 / fps) / playbackSpeed;
    const interval = setInterval(() => {
      // Sync frame from primary video if active
      if (
        videoARef.current &&
        !hasVideoAError &&
        Number.isFinite(videoARef.current.duration) &&
        videoARef.current.duration > 0 &&
        !videoARef.current.paused
      ) {
        const time = videoARef.current.currentTime;
        const duration = videoARef.current.duration;
        const progress = Math.max(0, Math.min(1, time / duration));
        const frameOffset = Math.floor(progress * totalFrames);
        setCurrentFrame(startFrame + Math.min(frameOffset, totalFrames - 1));

        if (videoBRef.current && Math.abs(videoBRef.current.currentTime - time) > 0.08) {
          videoBRef.current.currentTime = time;
        }
      } else {
        // Frame ticker fallback
        setCurrentFrame((prev) => {
          const next = prev + 1;
          if (next > endFrame) {
            if (isLooping) {
              if (videoARef.current) videoARef.current.currentTime = 0;
              if (videoBRef.current) videoBRef.current.currentTime = 0;
              return startFrame;
            } else {
              setIsPlaying(false);
              return endFrame;
            }
          }
          return next;
        });
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, fps, playbackSpeed, isLooping, startFrame, endFrame, totalFrames, hasVideoAError]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (isPlaying) {
      if (videoARef.current) try { videoARef.current.pause(); } catch {}
      if (videoBRef.current) try { videoBRef.current.pause(); } catch {}
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (videoARef.current && !hasVideoAError) {
        videoARef.current.muted = true;
        videoARef.current.play().catch(() => {});
      }
      if (videoBRef.current && !hasVideoBError) {
        videoBRef.current.muted = true;
        videoBRef.current.play().catch(() => {});
      }
    }
  };

  // Step Frame
  const stepFrame = (delta: number) => {
    if (isPlaying) {
      if (videoARef.current) videoARef.current.pause();
      if (videoBRef.current) videoBRef.current.pause();
      setIsPlaying(false);
    }
    const nextFrame = Math.max(startFrame, Math.min(endFrame, currentFrame + delta));
    setCurrentFrame(nextFrame);
    seekToFrame(nextFrame);
  };

  const seekToFrame = (frame: number) => {
    const progress = (frame - startFrame) / Math.max(1, totalFrames - 1);
    if (videoARef.current && videoARef.current.duration) {
      videoARef.current.currentTime = progress * videoARef.current.duration;
    }
    if (videoBRef.current && videoBRef.current.duration) {
      videoBRef.current.currentTime = progress * videoBRef.current.duration;
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value, 10);
    setCurrentFrame(frame);
    seekToFrame(frame);
  };

  // Draggable Split Screen Pointer Handler
  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingSplit.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplit.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setSplitPos(percentage);
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingSplit.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const progressPercent = Math.max(
    0,
    Math.min(100, ((currentFrame - startFrame) / Math.max(1, totalFrames - 1)) * 100)
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          togglePlay();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepFrame(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepFrame(1);
        } else if (e.key === 't' || e.key === 'T') {
          setToggleActiveA((prev) => !prev);
        }
      }}
      className={`flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl focus:outline-none focus:ring-1 focus:ring-blue-500/40 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      } ${className}`}
    >
      {/* Top Comparison Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 z-20">
        {/* Left: Version A / B Selectors */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {/* Version A Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-blue-500/40 shadow-inner">
            <span className="text-[10px] font-mono font-bold text-blue-400">A:</span>
            {allVersions.length > 0 ? (
              <select
                value={rawActiveA?.id || ''}
                onChange={(e) => {
                  const found = allVersions.find((v: any) => v.id === e.target.value);
                  if (found) isSwapped ? handleSelectB(found) : handleSelectA(found);
                }}
                className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                {allVersions.map((v: any) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-200">
                    {v.version_number ? `${v.version_number} - ${v.code || v.name || ''}` : v.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-mono font-bold text-blue-300">{labelA}</span>
            )}
          </div>

          {/* Swap Button */}
          <button
            onClick={() => setIsSwapped(!isSwapped)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 shadow-sm"
            title="Swap Version A and B (Swap order)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Version B Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/40 shadow-inner">
            <span className="text-[10px] font-mono font-bold text-amber-400">B:</span>
            {allVersions.length > 0 ? (
              <select
                value={rawActiveB?.id || ''}
                onChange={(e) => {
                  const found = allVersions.find((v: any) => v.id === e.target.value);
                  if (found) isSwapped ? handleSelectA(found) : handleSelectB(found);
                }}
                className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                {allVersions.map((v: any) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-200">
                    {v.version_number ? `${v.version_number} - ${v.code || v.name || ''}` : v.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-mono font-bold text-amber-300">{labelB}</span>
            )}
          </div>
        </div>

        {/* Center/Right: Compare Mode Switcher */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 shadow-sm">
          <button
            onClick={() => setMode('split')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'split' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5 mr-1" />
            Wipe / Split
          </button>
          <button
            onClick={() => setMode('side-by-side')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'side-by-side' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5 mr-1" />
            Side-by-Side
          </button>
          <button
            onClick={() => setMode('difference')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'difference' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Difference
          </button>
          <button
            onClick={() => setMode('onion-skin')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'onion-skin' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 mr-1" />
            Onion Skin
          </button>
          <button
            onClick={() => setMode('toggle')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'toggle' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Rapid A/B Flicker Toggle (Press 'T')"
          >
            <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" />
            A/B Flip
          </button>
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Compare'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Main Comparison Viewport Area */}
      <div
        className="relative min-h-[420px] max-h-[640px] flex-1 bg-slate-950 flex items-center justify-center overflow-hidden select-none"
      >
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

        {/* 1. SPLIT / WIPE MODE */}
        {mode === 'split' && (
          <div
            className="relative w-full h-[460px] flex items-center justify-center overflow-hidden"
            onPointerMove={handleSplitPointerMove}
          >
            {/* Version B Base Layer */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
              {!hasVideoBError ? (
                <video
                  ref={videoBRef}
                  poster={posterUrlB}
                  muted
                  playsInline
                  onError={() => setHasVideoBError(true)}
                  className="w-full h-full object-contain"
                >
                  <source src={videoUrlB} type="video/mp4" onError={() => setHasVideoBError(true)} />
                </video>
              ) : (
                <img src={posterUrlB} alt="Version B" className="w-full h-full object-contain" />
              )}
            </div>

            {/* Version A Top Clipped Layer */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)` }}
            >
              <div className="w-full h-full flex items-center justify-center">
                {!hasVideoAError ? (
                  <video
                    ref={videoARef}
                    poster={posterUrlA}
                    muted
                    playsInline
                    onError={() => setHasVideoAError(true)}
                    className="w-full h-full object-contain"
                  >
                    <source src={videoUrlA} type="video/mp4" onError={() => setHasVideoAError(true)} />
                  </video>
                ) : (
                  <img src={posterUrlA} alt="Version A" className="w-full h-full object-contain" />
                )}
              </div>
            </div>

            {/* Interactive Draggable Splitter Bar */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-30 flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.8)]"
              style={{ left: `${splitPos}%` }}
              onPointerDown={handleSplitPointerDown}
              onPointerMove={handleSplitPointerMove}
              onPointerUp={handleSplitPointerUp}
            >
              <div className="w-8 h-8 rounded-full bg-slate-900/95 border-2 border-white shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform cursor-grab active:cursor-grabbing">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Corner Indicators & Presets */}
            <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-blue-400/40 pointer-events-none">
              A: {labelA}
            </div>
            <div className="absolute top-3 right-3 bg-amber-600/90 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-amber-400/40 pointer-events-none">
              B: {labelB}
            </div>

            {/* Quick Split Ratio Presets */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 px-2 py-1 rounded-full text-[10px] font-mono text-slate-300 shadow-xl z-20">
              <span className="text-slate-500 mr-1">Split:</span>
              <button
                onClick={() => setSplitPos(25)}
                className={`px-1.5 py-0.5 rounded hover:bg-slate-800 ${splitPos === 25 ? 'text-blue-400 font-bold' : ''}`}
              >
                25%
              </button>
              <button
                onClick={() => setSplitPos(50)}
                className={`px-1.5 py-0.5 rounded hover:bg-slate-800 ${splitPos === 50 ? 'text-blue-400 font-bold' : ''}`}
              >
                50% (Center)
              </button>
              <button
                onClick={() => setSplitPos(75)}
                className={`px-1.5 py-0.5 rounded hover:bg-slate-800 ${splitPos === 75 ? 'text-blue-400 font-bold' : ''}`}
              >
                75%
              </button>
            </div>
          </div>
        )}

        {/* 2. SIDE-BY-SIDE MODE */}
        {mode === 'side-by-side' && (
          <div className="grid grid-cols-2 gap-3 w-full h-[460px] p-3">
            {/* Side A */}
            <div className="relative rounded-xl overflow-hidden border border-blue-500/40 bg-slate-900 flex items-center justify-center shadow-lg">
              {!hasVideoAError ? (
                <video
                  ref={videoARef}
                  poster={posterUrlA}
                  muted
                  playsInline
                  onError={() => setHasVideoAError(true)}
                  className="w-full h-full object-contain"
                >
                  <source src={videoUrlA} type="video/mp4" onError={() => setHasVideoAError(true)} />
                </video>
              ) : (
                <img src={posterUrlA} alt="Version A" className="w-full h-full object-contain" />
              )}
              <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold shadow">
                A: {labelA}
              </div>
              <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                {rawActiveA?.resolution || '4K DCI'} • {rawActiveA?.color_space || 'ACEScg'}
              </div>
            </div>

            {/* Side B */}
            <div className="relative rounded-xl overflow-hidden border border-amber-500/40 bg-slate-900 flex items-center justify-center shadow-lg">
              {!hasVideoBError ? (
                <video
                  ref={videoBRef}
                  poster={posterUrlB}
                  muted
                  playsInline
                  onError={() => setHasVideoBError(true)}
                  className="w-full h-full object-contain"
                >
                  <source src={videoUrlB} type="video/mp4" onError={() => setHasVideoBError(true)} />
                </video>
              ) : (
                <img src={posterUrlB} alt="Version B" className="w-full h-full object-contain" />
              )}
              <div className="absolute top-3 right-3 bg-amber-600/90 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold shadow">
                B: {labelB}
              </div>
              <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                {rawActiveB?.resolution || '4K DCI'} • {rawActiveB?.color_space || 'ACEScg'}
              </div>
            </div>
          </div>
        )}

        {/* 3. DIFFERENCE MODE */}
        {mode === 'difference' && (
          <div className="relative w-full h-[460px] flex items-center justify-center">
            {/* Version B Base */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center">
              {!hasVideoBError ? (
                <video
                  ref={videoBRef}
                  poster={posterUrlB}
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                >
                  <source src={videoUrlB} type="video/mp4" />
                </video>
              ) : (
                <img src={posterUrlB} alt="Version B" className="w-full h-full object-contain" />
              )}
            </div>

            {/* Version A Difference Blend */}
            <div
              className="absolute inset-0 w-full h-full flex items-center justify-center"
              style={{
                mixBlendMode: 'difference',
                filter: diffGain > 1 ? `contrast(${diffGain * 100}%) brightness(${diffGain * 100}%)` : undefined,
              }}
            >
              {!hasVideoAError ? (
                <video
                  ref={videoARef}
                  poster={posterUrlA}
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                >
                  <source src={videoUrlA} type="video/mp4" />
                </video>
              ) : (
                <img src={posterUrlA} alt="Version A" className="w-full h-full object-contain" />
              )}
            </div>

            <div className="absolute top-3 left-3 bg-purple-600/90 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-purple-400/40">
              Difference Map (Black = Identical Pixels)
            </div>

            {/* Gain control for subtle noise differences */}
            <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-2 text-xs font-mono text-slate-300">
              <span className="text-slate-400">Diff Gain:</span>
              {[1, 2, 4, 8].map((g) => (
                <button
                  key={g}
                  onClick={() => setDiffGain(g)}
                  className={`px-1.5 py-0.5 rounded ${diffGain === g ? 'bg-purple-600 text-white font-bold' : 'hover:bg-slate-800'}`}
                >
                  {g}x
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. ONION SKIN MODE */}
        {mode === 'onion-skin' && (
          <div className="relative w-full h-[460px] flex items-center justify-center">
            {/* Version B Base */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-center">
              {!hasVideoBError ? (
                <video
                  ref={videoBRef}
                  poster={posterUrlB}
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                >
                  <source src={videoUrlB} type="video/mp4" />
                </video>
              ) : (
                <img src={posterUrlB} alt="Version B" className="w-full h-full object-contain" />
              )}
            </div>

            {/* Version A Opacity Blend */}
            <div
              className="absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-75"
              style={{ opacity: onionOpacity / 100 }}
            >
              {!hasVideoAError ? (
                <video
                  ref={videoARef}
                  poster={posterUrlA}
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                >
                  <source src={videoUrlA} type="video/mp4" />
                </video>
              ) : (
                <img src={posterUrlA} alt="Version A" className="w-full h-full object-contain" />
              )}
            </div>

            <div className="absolute top-3 left-3 bg-indigo-600/90 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-indigo-400/40">
              Onion Blend: {onionOpacity}% A / {100 - onionOpacity}% B
            </div>
          </div>
        )}

        {/* 5. FLICKER / TOGGLE MODE */}
        {mode === 'toggle' && (
          <div className="relative w-full h-[460px] flex items-center justify-center">
            {toggleActiveA ? (
              <div className="w-full h-full flex items-center justify-center">
                {!hasVideoAError ? (
                  <video
                    ref={videoARef}
                    poster={posterUrlA}
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  >
                    <source src={videoUrlA} type="video/mp4" />
                  </video>
                ) : (
                  <img src={posterUrlA} alt="Version A" className="w-full h-full object-contain" />
                )}
                <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white font-bold shadow-lg">
                  Viewing A: {labelA}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {!hasVideoBError ? (
                  <video
                    ref={videoBRef}
                    poster={posterUrlB}
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  >
                    <source src={videoUrlB} type="video/mp4" />
                  </video>
                ) : (
                  <img src={posterUrlB} alt="Version B" className="w-full h-full object-contain" />
                )}
                <div className="absolute top-3 left-3 bg-amber-600/90 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white font-bold shadow-lg">
                  Viewing B: {labelB}
                </div>
              </div>
            )}

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-slate-900/90 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-full shadow-2xl">
              <button
                onClick={() => setToggleActiveA(true)}
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
                  toggleActiveA ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Show A
              </button>
              <button
                onClick={() => setToggleActiveA(false)}
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
                  !toggleActiveA ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Show B
              </button>
              <span className="text-[10px] font-mono text-slate-400 pl-1 border-l border-slate-700">
                (Press 'T' to Flip)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mode-specific Sub-controls (e.g. Onion Skin Slider) */}
      {mode === 'onion-skin' && (
        <div className="px-4 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3 w-full max-w-lg mx-auto">
            <span className="text-xs font-mono text-amber-400 font-bold">100% B</span>
            <input
              type="range"
              min="0"
              max="100"
              value={onionOpacity}
              onChange={(e) => setOnionOpacity(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-xs font-mono text-blue-400 font-bold">100% A</span>
          </div>
        </div>
      )}

      {/* Synchronized Playback Scrubber & Transport Bar */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 space-y-2.5 z-20">
        {/* Scrubber Timeline */}
        <div className="relative flex items-center space-x-2.5">
          <span className="text-[10px] font-mono text-slate-400 w-12 text-right select-none">{startFrame}</span>
          <div className="relative flex-1 flex items-center h-6 group">
            {/* Background Track */}
            <div className="absolute inset-x-0 h-2 bg-slate-800 rounded-lg overflow-hidden border border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-amber-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Range Scrubber Input */}
            <input
              type="range"
              min={startFrame}
              max={endFrame}
              value={isNaN(currentFrame) ? startFrame : currentFrame}
              onChange={handleScrubberChange}
              className="relative z-10 w-full h-4 opacity-0 cursor-pointer"
            />
            {/* Playhead Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full shadow-md pointer-events-none group-hover:scale-125 transition-transform"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-400 w-12 select-none">{endFrame}</span>
        </div>

        {/* Transport Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Left: Frame & Time HUD */}
          <div className="flex items-center space-x-2.5">
            <div className="px-2.5 py-1 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-200">
              <span className="text-slate-500 mr-1">Frame:</span>
              <strong className="text-blue-400">{currentFrame}</strong>
              <span className="text-slate-600 mx-1">/</span>
              <span className="text-slate-400">{endFrame}</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono text-slate-400 border-slate-800">
              {fps} FPS Lock
            </Badge>
          </div>

          {/* Center: Play / Pause / Step Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => {
                setCurrentFrame(startFrame);
                seekToFrame(startFrame);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Jump to Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => stepFrame(-1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Step Back 1 Frame (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className={`px-4 py-1.5 rounded-lg text-white font-bold flex items-center space-x-1.5 shadow-md transition-all ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
              title={isPlaying ? 'Pause (Space)' : 'Play Synchronized (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              <span className="text-xs font-mono">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              onClick={() => stepFrame(1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Step Forward 1 Frame (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isLooping
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
              }`}
              title={isLooping ? 'Loop Enabled' : 'Loop Disabled'}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Playback Speed Selector */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-mono text-slate-500 mr-1">Speed:</span>
            {[0.5, 1, 2].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
