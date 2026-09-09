import React, { useState } from 'react';
import {
  Box,
  Layers,
  Sparkles,
  Play,
  Pause,
  Maximize2,
  ExternalLink,
  Cpu,
  User,
  Star,
  Film,
} from 'lucide-react';
import { Asset } from '@/types/assets';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

interface AssetGalleryViewProps {
  assets: Asset[];
}

export const AssetGalleryView: React.FC<AssetGalleryViewProps> = ({ assets }) => {
  const [activeTurntables, setActiveTurntables] = useState<{ [id: string]: boolean }>({});

  const toggleTurntable = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTurntables((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {assets.map((asset) => {
        const isSpinning = !!activeTurntables[asset.id];
        const polyMillions = (asset.poly_count / 1000000).toFixed(2);

        return (
          <div
            key={asset.id}
            className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
          >
            <div>
              {/* Turntable / Visual Canvas Area */}
              <div className="relative aspect-16/10 bg-slate-950 overflow-hidden">
                <img
                  src={asset.thumbnail_url}
                  alt={asset.name}
                  className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                    isSpinning ? 'scale-110 rotate-1' : ''
                  }`}
                />

                {/* Top Overlay Badges */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                  <div className="flex items-center space-x-1.5 pointer-events-auto">
                    <span className="px-2.5 py-1 bg-slate-950/85 backdrop-blur-md text-emerald-400 text-xs font-mono font-bold rounded-lg border border-slate-800 shadow-md">
                      {asset.version}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono bg-slate-950/85 backdrop-blur-md text-indigo-300 border-indigo-500/30"
                    >
                      {asset.category}
                    </Badge>
                  </div>

                  <div className="pointer-events-auto">
                    <StatusBadge status={asset.status} />
                  </div>
                </div>

                {/* Bottom Canvas Controls */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                  <button
                    onClick={(e) => toggleTurntable(asset.id, e)}
                    className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-950/85 backdrop-blur-md hover:bg-emerald-600 text-white rounded-lg border border-slate-800 text-[11px] font-mono transition-all shadow-md"
                  >
                    {isSpinning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{isSpinning ? 'Stop Turntable' : '360° View'}</span>
                  </button>

                  <div className="flex items-center space-x-1 text-[10px] font-mono bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
                    <Cpu className="w-3 h-3 text-cyan-400" />
                    <span>{asset.poly_count > 0 ? `${polyMillions}M Tris` : 'Volumetric'}</span>
                  </div>
                </div>
              </div>

              {/* Asset Information Body */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      {asset.project_code} • {asset.software} DCC
                    </span>
                    <Link to={`/assets/${asset.id}`}>
                      <h3 className="text-sm font-bold text-white hover:text-emerald-400 transition-colors mt-0.5 line-clamp-1">
                        {asset.name}
                      </h3>
                    </Link>
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  {asset.description}
                </p>

                {/* Tech Badges Row */}
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px]">
                  <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-300">
                    {asset.lod_levels} LODs
                  </span>
                  <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-amber-300">
                    {asset.material_count || 12} Shaders
                  </span>
                  <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-cyan-300 truncate max-w-[140px]">
                    {asset.texture_resolution || '8K UDIM'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <img
                  src={asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                  alt={asset.assigned_artist_name || 'Artist'}
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-700"
                />
                <span className="text-xs text-slate-300 font-sans">{asset.assigned_artist_name || 'Sarah Jenkins'}</span>
              </div>

              <Link to={`/assets/${asset.id}`}>
                <Button size="sm" variant="ghost" className="text-xs h-7 px-2.5 hover:bg-slate-800">
                  Open Stage <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
};
