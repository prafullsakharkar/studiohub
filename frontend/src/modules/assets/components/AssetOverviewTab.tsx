import React, { useState } from 'react';
import {
  Box,
  Layers,
  Cpu,
  Database,
  Film,
  CheckCircle2,
  Clock,
  User,
  Users2,
  Play,
  Pause,
  RotateCw,
  Eye,
  Maximize2,
  FolderTree,
  FileCode,
  Tag,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Sliders,
  BarChart2,
} from 'lucide-react';
import { Asset } from '@/types/assets';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

interface AssetOverviewTabProps {
  asset: Asset;
  onNavigateTab: (tabId: string) => void;
}

export const AssetOverviewTab: React.FC<AssetOverviewTabProps> = ({ asset, onNavigateTab }) => {
  const [isPlayingTurntable, setIsPlayingTurntable] = useState(false);
  const [viewportShaderMode, setViewportShaderMode] = useState<'textured' | 'wireframe' | 'clay' | 'normals'>('textured');
  const [activeLod, setActiveLod] = useState<number>(0);

  const polyCountMillions = (asset.poly_count / 1000000).toFixed(2);
  const lodCounts = [
    { lod: 'LOD0', tris: asset.poly_count, percent: '100%', use: 'Hero Close-up' },
    { lod: 'LOD1', tris: Math.round(asset.poly_count * 0.5), percent: '50%', use: 'Mid-ground' },
    { lod: 'LOD2', tris: Math.round(asset.poly_count * 0.2), percent: '20%', use: 'Background' },
    { lod: 'LOD3', tris: Math.round(asset.poly_count * 0.05), percent: '5%', use: 'Crowd / Proxy' },
  ].slice(0, asset.lod_levels || 4);

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">Poly Budget</span>
            <span className="text-lg font-bold text-white font-mono mt-0.5 block">
              {asset.poly_count > 0 ? `${polyCountMillions}M` : 'Volumetric'}
            </span>
            <span className="text-[10px] text-indigo-400 font-mono">Triangles (LOD0)</span>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Cpu className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">LOD Levels</span>
            <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
              {asset.lod_levels} Cascades
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Auto-generated</span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">MaterialX Shaders</span>
            <span className="text-lg font-bold text-amber-400 font-mono mt-0.5 block">
              {asset.material_count || 12} Shaders
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{asset.texture_resolution || '8K UDIM'}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">USD Version</span>
            <span className="text-lg font-bold text-cyan-400 font-mono mt-0.5 block">
              {asset.version}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{asset.software} DCC</span>
          </div>
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Database className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Viewport & Specs Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Interactive 3D Turntable / Hero Viewport */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative group">
            {/* Viewport Header Controls */}
            <div className="bg-slate-950/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between z-10 relative">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  OpenUSD Hydra Viewport
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-300">
                  Solaris / Storm
                </Badge>
              </div>

              {/* Shader Shading Modes */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                {(['textured', 'wireframe', 'clay', 'normals'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewportShaderMode(mode)}
                    className={`px-2 py-1 rounded capitalize transition-all ${
                      viewportShaderMode === mode
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Viewport Canvas Screen */}
            <div className="relative aspect-16/10 bg-slate-950 flex items-center justify-center overflow-hidden">
              <img
                src={asset.thumbnail_url}
                alt={asset.name}
                className={`w-full h-full object-cover transition-all duration-700 ${
                  viewportShaderMode === 'wireframe'
                    ? 'filter invert contrast-200 hue-rotate-90 opacity-80'
                    : viewportShaderMode === 'clay'
                    ? 'filter grayscale contrast-125'
                    : viewportShaderMode === 'normals'
                    ? 'filter hue-rotate-180 contrast-150'
                    : ''
                } ${isPlayingTurntable ? 'scale-105 transition-transform duration-3000 ease-linear' : ''}`}
              />

              {/* Viewport Overlay Info HUD */}
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1 select-none pointer-events-none">
                <div className="flex items-center gap-2 text-white font-bold">
                  <span>{asset.code}</span>
                  <span className="text-emerald-400">{asset.version}</span>
                </div>
                <div className="text-slate-400">Prim: {asset.usd_prim_path || `/World/Assets/${asset.code}`}</div>
                <div className="text-slate-400">Color: ACEScg (Rec.709 ODT)</div>
                <div className="text-indigo-300 font-semibold">Active: {lodCounts[activeLod]?.lod || 'LOD0'} ({lodCounts[activeLod]?.percent || '100%'} Res)</div>
              </div>

              {/* Viewport Bottom Controls */}
              <div className="absolute bottom-3 inset-x-3 bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant={isPlayingTurntable ? 'primary' : 'outline'}
                    onClick={() => setIsPlayingTurntable(!isPlayingTurntable)}
                    leftIcon={isPlayingTurntable ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    className="text-xs h-7 px-2.5"
                  >
                    {isPlayingTurntable ? 'Stop 360°' : 'Spin Turntable'}
                  </Button>

                  <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
                    {lodCounts.map((lodItem, index) => (
                      <button
                        key={lodItem.lod}
                        onClick={() => setActiveLod(index)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                          activeLod === index
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {lodItem.lod}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                  <span>FOV: 50mm</span>
                  <span>Grid: 1m</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigateTab('reviews')}
                  leftIcon={<Film className="w-3.5 h-3.5 text-amber-400" />}
                >
                  Review Turnarounds
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigateTab('publishing')}
                  leftIcon={<Database className="w-3.5 h-3.5 text-cyan-400" />}
                >
                  USD Layers
                </Button>
              </div>

              <span className="text-[11px] font-mono text-slate-500">
                Stage: {asset.usd_stage_url || '@studio/shows/NK99/assets/hero.usd@'}
              </span>
            </div>
          </div>

          {/* LOD Cascade Breakdown Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                LOD Polygon Cascade Allocation
              </h3>
              <span className="text-[11px] font-mono text-slate-400">4 Levels Configured</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {lodCounts.map((l, i) => (
                <div
                  key={l.lod}
                  onClick={() => setActiveLod(i)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    activeLod === i
                      ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-indigo-300">{l.lod}</span>
                    <span className="text-[10px] text-slate-400">{l.percent}</span>
                  </div>
                  <div className="text-sm font-bold text-white">{(l.tris / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">{l.use}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Technical Metadata & Pipeline Assignments */}
        <div className="lg:col-span-5 space-y-4">
          {/* Metadata & Technical Specs Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              Technical Specifications
            </h3>

            <div className="divide-y divide-slate-800/60 text-xs font-mono">
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Asset Code</span>
                <span className="text-white font-bold">{asset.code}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Category / Type</span>
                <Badge variant="outline" className="text-[10px] font-mono text-indigo-300 border-indigo-500/30">
                  {asset.category}
                </Badge>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Primary DCC</span>
                <span className="text-cyan-300 font-semibold">{asset.software}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Payload File Format</span>
                <span className="text-emerald-300">{asset.file_format}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Bounding Box (XYZ)</span>
                <span className="text-slate-300">{asset.bounding_box || '4.2m x 2.1m x 1.6m'}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Texture Tiles</span>
                <span className="text-amber-300">{asset.texture_resolution || '8K UDIM (32 tiles)'}</span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">USD Prim Path</span>
                <span className="text-slate-300 text-[11px] truncate max-w-[180px]" title={asset.usd_prim_path}>
                  {asset.usd_prim_path || `/World/Assets/${asset.code}`}
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-slate-400">Production Status</span>
                <StatusBadge status={asset.status} />
              </div>
            </div>
          </div>

          {/* Department & Team Assignment */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Users2 className="w-4 h-4 text-emerald-400" />
              Ownership & Assignments
            </h3>

            <div className="space-y-3">
              {/* Department */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Department</span>
                  <span className="text-xs font-semibold text-white mt-0.5 block">{asset.department_name}</span>
                </div>
                <Link to={`/departments/${asset.department_id || 'dept-02'}`}>
                  <Button size="sm" variant="ghost" className="text-xs h-7 px-2">
                    View Dept
                  </Button>
                </Link>
              </div>

              {/* Team */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Assigned Crew</span>
                  <span className="text-xs font-semibold text-white mt-0.5 block">{asset.team_name}</span>
                </div>
                <Link to={`/teams/${asset.team_id || 'team-02'}`}>
                  <Button size="sm" variant="ghost" className="text-xs h-7 px-2">
                    View Crew
                  </Button>
                </Link>
              </div>

              {/* Lead Artist */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <img
                    src={asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                    alt={asset.assigned_artist_name || 'Artist'}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-emerald-500/40"
                  />
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-500 block">Lead Modeler</span>
                    <span className="text-xs font-semibold text-white">{asset.assigned_artist_name || 'Sarah Jenkins'}</span>
                  </div>
                </div>
                <Link to={`/people/${asset.assigned_artist_id || 'usr-004'}`}>
                  <Button size="sm" variant="ghost" className="text-xs h-7 px-2">
                    Profile
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Description & Tags Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" />
              Creative Brief & Tags
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
              {asset.description || 'No creative brief specified.'}
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {asset.tags && asset.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono rounded border border-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
