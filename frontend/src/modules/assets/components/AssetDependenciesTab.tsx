import React, { useState } from 'react';
import type { Asset } from '@/types/production';
import { AssetHierarchyTree } from './AssetHierarchyTree';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import {
  FolderTree,
  Box,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Database,
  FileCode,
  Link as LinkIcon,
  Sparkles,
  GitFork,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface AssetDependenciesTabProps {
  asset: Asset;
  allAssets?: Asset[];
}

export const AssetDependenciesTab: React.FC<AssetDependenciesTabProps> = ({
  asset,
  allAssets = [],
}) => {
  const [viewMode, setViewMode] = useState<'hierarchy' | 'graph'>('hierarchy');

  const upstreamDependencies = [
    {
      name: 'Hero LookDev MaterialX Package',
      type: 'Shader / Texture Library',
      source: `@studio/shows/${asset.project_code}/textures/hero_materials.usda`,
      status: 'Synced',
      version: 'v004',
      size: '1.2 GB',
    },
    {
      name: 'SubD Topology & Quads Base Mesh',
      type: 'Geometry Cache',
      source: `@studio/shows/${asset.project_code}/models/${asset.code.toLowerCase()}_base.usdc`,
      status: 'Synced',
      version: 'v009',
      size: '340 MB',
    },
    {
      name: 'Standard Character/Prop Rig Template',
      type: 'USD Skel Schema',
      source: `@studio/templates/rigs/bipedal_rig_master.usda`,
      status: 'Locked',
      version: 'v012',
      size: '45 MB',
    },
  ];

  const downstreamDependencies = [
    {
      name: 'Master USD Stage Composition',
      type: 'Production Stage',
      target: asset.usd_prim_path || `/World/Assets/${asset.code}`,
      status: 'Active',
      impact: '12 Sequences / 48 Shots',
    },
    {
      name: 'Layout Stage Instancer',
      type: 'Point Instancer Payload',
      target: `/World/Layout/Sets/${asset.project_code}_HeroSet`,
      status: 'Active',
      impact: 'Layout & Camera Dept',
    },
    {
      name: 'Lighting & LookDev Test Turntable',
      type: 'Karma / Solaris Turntable',
      target: `/World/LookDev/Turntables/${asset.code}_Turnaround`,
      status: 'Active',
      impact: 'LookDev Sign-off',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <GitFork className="w-4 h-4 text-cyan-400" />
            OpenUSD Asset Dependencies & Hierarchy Composition
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upstream shaders, sublayer geometry schemas, child prim assemblies, and downstream shot stage references
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('hierarchy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              viewMode === 'hierarchy'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Stage Hierarchy Tree
          </button>
          <button
            onClick={() => setViewMode('graph')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              viewMode === 'graph'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Dependency Matrix
          </button>
        </div>
      </div>

      {viewMode === 'hierarchy' ? (
        <AssetHierarchyTree assets={allAssets.length > 0 ? allAssets : [asset]} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upstream Dependencies */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-indigo-400" /> Upstream Dependencies (Inputs)
              </h4>
              <span className="text-[11px] font-mono text-slate-400">{upstreamDependencies.length} Sources</span>
            </div>

            <div className="space-y-3">
              {upstreamDependencies.map((dep) => (
                <div
                  key={dep.name}
                  className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{dep.name}</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                      {dep.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-indigo-400 truncate">{dep.source}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    <span>{dep.type} • {dep.version}</span>
                    <span>{dep.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Downstream Dependencies */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4 text-emerald-400" /> Downstream References (Outputs)
              </h4>
              <span className="text-[11px] font-mono text-slate-400">{downstreamDependencies.length} Outputs</span>
            </div>

            <div className="space-y-3">
              {downstreamDependencies.map((dep) => (
                <div
                  key={dep.name}
                  className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{dep.name}</span>
                    <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                      {dep.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-400 truncate">{dep.target}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    <span>{dep.type}</span>
                    <span className="text-slate-400 font-semibold">{dep.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
