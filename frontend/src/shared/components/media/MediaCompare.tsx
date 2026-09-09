import React, { useState, useRef } from 'react';
import {
  Columns,
  SplitSquareVertical,
  Layers,
  Sparkles,
  ArrowLeftRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Repeat,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { MediaItem } from '@/types/media';
import { Button } from '../Button';
import { Badge } from '../Badge';

interface MediaCompareProps {
  versionA?: Partial<ProductionVersion> | Partial<MediaItem>;
  versionB?: Partial<ProductionVersion> | Partial<MediaItem>;
  allVersions?: (ProductionVersion | MediaItem)[];
  onSelectVersionA?: (ver: any) => void;
  onSelectVersionB?: (ver: any) => void;
  className?: string;
}

export type CompareMode = 'split' | 'side-by-side' | 'difference' | 'onion-skin';

export const MediaCompare: React.FC<MediaCompareProps> = ({
  versionA,
  versionB,
  allVersions = [],
  onSelectVersionA,
  onSelectVersionB,
  className = '',
}) => {
  const [mode, setMode] = useState<CompareMode>('split');
  const [splitPos, setSplitPos] = useState<number>(50); // 0 to 100 percentage
  const [onionOpacity, setOnionOpacity] = useState<number>(50); // 0 to 100 percentage
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(1001);
  const [isSwapped, setIsSwapped] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSplit = useRef<boolean>(false);

  const activeA: any = isSwapped ? versionB : versionA;
  const activeB: any = isSwapped ? versionA : versionB;

  const urlA = activeA?.video_url || activeA?.preview_url || activeA?.thumbnail_url || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800';
  const urlB = activeB?.video_url || activeB?.preview_url || activeB?.thumbnail_url || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800';

  const labelA = activeA?.version_number || activeA?.code || activeA?.name || 'Version A';
  const labelB = activeB?.version_number || activeB?.code || activeB?.name || 'Version B';

  const handleMouseDown = () => {
    isDraggingSplit.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSplit.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSplitPos(percentage);
  };

  const handleMouseUp = () => {
    isDraggingSplit.current = false;
  };

  return (
    <div className={`flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl ${className}`}>
      {/* Top Comparison Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        {/* Left: Version A / B Selectors */}
        <div className="flex items-center space-x-2">
          {/* Version A Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded border border-blue-500/40">
            <span className="text-[10px] font-mono font-bold text-blue-400">A:</span>
            {allVersions.length > 0 && onSelectVersionA ? (
              <select
                value={activeA?.id}
                onChange={(e) => {
                  const found = allVersions.find((v) => v.id === e.target.value);
                  if (found) isSwapped ? onSelectVersionB?.(found) : onSelectVersionA(found);
                }}
                className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer"
              >
                {allVersions.map((v: any) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-200">
                    {v.version_number ? `${v.version_number} - ${v.code || v.name}` : v.name}
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
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Swap Version A and B"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Version B Dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded border border-amber-500/40">
            <span className="text-[10px] font-mono font-bold text-amber-400">B:</span>
            {allVersions.length > 0 && onSelectVersionB ? (
              <select
                value={activeB?.id}
                onChange={(e) => {
                  const found = allVersions.find((v) => v.id === e.target.value);
                  if (found) isSwapped ? onSelectVersionA?.(found) : onSelectVersionB(found);
                }}
                className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer"
              >
                {allVersions.map((v: any) => (
                  <option key={v.id} value={v.id} className="bg-slate-900 text-slate-200">
                    {v.version_number ? `${v.version_number} - ${v.code || v.name}` : v.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-mono font-bold text-amber-300">{labelB}</span>
            )}
          </div>
        </div>

        {/* Right: Compare Mode Tabs */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setMode('split')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'split' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5 mr-1" />
            Wipe / Split
          </button>
          <button
            onClick={() => setMode('side-by-side')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'side-by-side' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns className="w-3.5 h-3.5 mr-1" />
            Side-by-Side
          </button>
          <button
            onClick={() => setMode('difference')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'difference' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Difference
          </button>
          <button
            onClick={() => setMode('onion-skin')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              mode === 'onion-skin' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 mr-1" />
            Onion Skin
          </button>
        </div>
      </div>

      {/* Main Comparison Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative min-h-[400px] max-h-[620px] bg-slate-950 flex items-center justify-center overflow-hidden select-none cursor-default"
      >
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* 1. SPLIT / WIPE MODE */}
        {mode === 'split' && (
          <div className="relative w-full h-[450px] flex items-center justify-center overflow-hidden">
            {/* Version B Base Layer */}
            <img
              src={urlB}
              alt="Version B"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />
            {/* Version A Top Clipped Layer */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)` }}
            >
              <img
                src={urlA}
                alt="Version A"
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>

            {/* Interactive Draggable Split Handle Line */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.7)]"
              style={{ left: `${splitPos}%` }}
              onMouseDown={handleMouseDown}
            >
              <div className="w-7 h-7 rounded-full bg-slate-900 border-2 border-white shadow-xl flex items-center justify-center text-white">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Corner Indicators */}
            <div className="absolute top-3 left-3 bg-blue-600/80 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-blue-400/40">
              A: {labelA}
            </div>
            <div className="absolute top-3 right-3 bg-amber-600/80 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-amber-400/40">
              B: {labelB}
            </div>
          </div>
        )}

        {/* 2. SIDE-BY-SIDE MODE */}
        {mode === 'side-by-side' && (
          <div className="grid grid-cols-2 gap-2 w-full h-[450px] p-3">
            {/* Side A */}
            <div className="relative rounded-lg overflow-hidden border border-blue-500/40 bg-slate-900 flex items-center justify-center shadow-md">
              <img src={urlA} alt="Version A" className="w-full h-full object-contain" />
              <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold">
                A: {labelA}
              </div>
              <div className="absolute bottom-3 left-3 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                {(activeA as any)?.resolution || '4K DCI'} • {(activeA as any)?.color_space || 'ACEScg'}
              </div>
            </div>

            {/* Side B */}
            <div className="relative rounded-lg overflow-hidden border border-amber-500/40 bg-slate-900 flex items-center justify-center shadow-md">
              <img src={urlB} alt="Version B" className="w-full h-full object-contain" />
              <div className="absolute top-3 right-3 bg-amber-600/90 backdrop-blur px-2.5 py-1 rounded text-xs font-mono text-white font-bold">
                B: {labelB}
              </div>
              <div className="absolute bottom-3 right-3 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                {(activeB as any)?.resolution || '4K DCI'} • {(activeB as any)?.color_space || 'ACEScg'}
              </div>
            </div>
          </div>
        )}

        {/* 3. DIFFERENCE MODE */}
        {mode === 'difference' && (
          <div className="relative w-full h-[450px] flex items-center justify-center">
            {/* Version B Base */}
            <img src={urlB} alt="Version B" className="absolute inset-0 w-full h-full object-contain" />
            {/* Version A Difference Blend */}
            <img
              src={urlA}
              alt="Version A"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ mixBlendMode: 'difference' }}
            />
            <div className="absolute top-3 left-3 bg-purple-600/80 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-purple-400/40">
              Difference Map (Pixel Discrepancy Highlights)
            </div>
          </div>
        )}

        {/* 4. ONION SKIN MODE */}
        {mode === 'onion-skin' && (
          <div className="relative w-full h-[450px] flex items-center justify-center">
            {/* Version B Base */}
            <img src={urlB} alt="Version B" className="absolute inset-0 w-full h-full object-contain" />
            {/* Version A Opacity Blend */}
            <img
              src={urlA}
              alt="Version A"
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-75"
              style={{ opacity: onionOpacity / 100 }}
            />
            <div className="absolute top-3 left-3 bg-indigo-600/80 backdrop-blur px-3 py-1 rounded text-xs font-mono text-white font-bold shadow-lg border border-indigo-400/40">
              Onion Skin ({onionOpacity}% A / {100 - onionOpacity}% B)
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
        {mode === 'onion-skin' ? (
          <div className="flex items-center space-x-3 w-full max-w-md">
            <span className="text-xs font-mono text-amber-400 font-bold">B: 100%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={onionOpacity}
              onChange={(e) => setOnionOpacity(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span className="text-xs font-mono text-blue-400 font-bold">A: 100%</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span>Comparing:</span>
            <span className="text-blue-400 font-semibold">{labelA}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-amber-400 font-semibold">{labelB}</span>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-[11px] font-mono text-slate-400 border-slate-700">
            Synchronized Frame Lock
          </Badge>
        </div>
      </div>
    </div>
  );
};
