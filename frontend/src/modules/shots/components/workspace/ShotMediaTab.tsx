import React, { useState, useEffect } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { Shot } from '@/types/production';
import {
  Film,
  Play,
  Pause,
  Download,
  ExternalLink,
  Layers,
  FileCode,
  HardDrive,
  Maximize2,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export interface ShotMediaTabProps {
  shot: Shot;
}

export const ShotMediaTab: React.FC<ShotMediaTabProps> = ({ shot }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const frameIn = shot.frame_in || 1001;
  const frameOut = shot.frame_out || 1086;
  const [currentFrame, setCurrentFrame] = useState(frameIn);

  // Smooth Playback Loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        const next = prev + 1;
        if (next > frameOut) {
          return frameIn;
        }
        return next;
      });
    }, 1000 / 24);

    return () => clearInterval(interval);
  }, [isPlaying, frameIn, frameOut]);

  const progressPercent = Math.max(
    0,
    Math.min(100, (((currentFrame - frameIn) / Math.max(1, frameOut - frameIn)) * 100))
  );

  const mediaFiles = [
    {
      id: 'm-1',
      name: `${shot.code}_comp_hero_v003.mov`,
      type: 'QuickTime ProRes 4444 XQ',
      category: 'Hero Playblast',
      size: '1.42 GB',
      resolution: '4096 × 1716 DCI 4K',
      colorspace: 'ACEScg',
      path: `/volumes/renders/${shot.project_code || 'VFX'}/${shot.sequence_code}/${shot.code}/comp/v003/`,
      isHero: true,
    },
    {
      id: 'm-2',
      name: `${shot.code}_beauty.%04d.exr`,
      type: 'OpenEXR 16-bit float (DWAA)',
      category: 'Render Passes',
      size: '8.76 GB (120 files)',
      resolution: '4096 × 1716',
      colorspace: 'ACEScg',
      path: `/volumes/renders/${shot.project_code || 'VFX'}/${shot.sequence_code}/${shot.code}/lighting/v002/`,
      isHero: false,
    },
    {
      id: 'm-3',
      name: `${shot.code}_plate_bg_v001.%04d.dpx`,
      type: '10-bit DPX Log',
      category: 'Camera Ingest Plate',
      size: '3.15 GB (136 frames)',
      resolution: '4096 × 1716',
      colorspace: 'Sony S-Gamut3.Cine',
      path: `/volumes/plates/${shot.project_code || 'VFX'}/${shot.sequence_code}/${shot.code}/`,
      isHero: false,
    },
    {
      id: 'm-4',
      name: `${shot.code}_fx_smoke_sim.usd`,
      type: 'OpenUSD Stage Payload',
      category: 'USD FX Cache',
      size: '520 MB',
      resolution: 'VDB Grids + USD Prims',
      colorspace: 'Linear',
      path: `/volumes/usd/${shot.project_code || 'VFX'}/${shot.sequence_code}/${shot.code}/fx/`,
      isHero: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Player Section */}
      <Card className="border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
        <div className="relative aspect-video max-h-[460px] bg-black flex items-center justify-center group overflow-hidden">
          {shot.thumbnail_url ? (
            <SmartImg
              src={shot.thumbnail_url}
              alt={shot.code}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-600 gap-2">
              <Film className="w-16 h-16" />
              <span className="text-xs font-mono">No video media stream loaded</span>
            </div>
          )}

          {/* Overlays */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-xs font-mono text-indigo-300 font-bold border border-indigo-500/30">
              {shot.code} ({shot.current_version || 'v001'})
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-xs font-mono text-slate-300 border border-slate-700">
              Frame: {currentFrame} / {shot.frame_out}
            </span>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-xs font-mono text-emerald-400 border border-emerald-500/30">
              ACES 1.3 OCIO • Rec.709 Preview
            </span>
          </div>

          {/* Central Play/Pause */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="absolute inset-0 m-auto w-16 h-16 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl hover:bg-indigo-500 hover:scale-110 transition-all border border-indigo-400/40"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-white" />
            ) : (
              <Play className="w-7 h-7 ml-1 fill-white" />
            )}
          </button>

          {/* Bottom Player Scrub Bar */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>F: {frameIn}</span>
              <span className="text-indigo-400 font-bold">F: {currentFrame}</span>
              <span>F: {frameOut}</span>
            </div>
            <div className="relative flex items-center h-4 group">
              <div className="absolute inset-x-0 h-1.5 bg-slate-800 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-lg"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <input
                type="range"
                min={frameIn}
                max={frameOut}
                value={currentFrame}
                onChange={(e) => setCurrentFrame(Number(e.target.value))}
                className="relative z-10 w-full h-4 opacity-0 cursor-pointer"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-indigo-500 rounded-full shadow pointer-events-none"
                style={{ left: `calc(${progressPercent}% - 7px)` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Media Ingest & Sequence Files List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Ingested Media & Render Packages ({mediaFiles.length})
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mediaFiles.map((file) => (
            <Card
              key={file.id}
              className={`border bg-slate-900 shadow-md ${
                file.isHero ? 'border-indigo-500/40' : 'border-slate-800'
              }`}
            >
              <CardBody className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white font-mono truncate">
                        {file.name}
                      </h4>
                      {file.isHero && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          HERO
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{file.category}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-500">Format:</span> {file.type}
                  </div>
                  <div>
                    <span className="text-slate-500">Size:</span> {file.size}
                  </div>
                  <div>
                    <span className="text-slate-500">Res:</span> {file.resolution}
                  </div>
                  <div>
                    <span className="text-slate-500">Color:</span> {file.colorspace}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-500 truncate bg-slate-950 px-2 py-1 rounded border border-slate-800">
                  {file.path}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
