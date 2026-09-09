import React, { useState } from 'react';
import {
  FolderTree,
  Box,
  Layers,
  ChevronRight,
  ChevronDown,
  Cpu,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Asset, AssetHierarchyNode } from '@/types/assets';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Link } from 'react-router-dom';

interface AssetHierarchyTreeProps {
  assets: Asset[];
}

interface TreeNodeProps {
  node: AssetHierarchyNode;
  level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
          level === 0
            ? 'bg-slate-900/90 border-slate-800 text-white font-semibold'
            : level === 1
            ? 'bg-slate-950/70 border-slate-800/80 text-slate-200 ml-6'
            : 'bg-slate-950/40 border-slate-800/40 text-slate-300 ml-12'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          {hasChildren ? (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-5 h-5 flex items-center justify-center text-slate-600">•</span>
          )}

          <Box className={`w-4 h-4 ${level === 0 ? 'text-indigo-400' : 'text-emerald-400'}`} />

          <div>
            <div className="flex items-center space-x-2 font-mono text-xs">
              <span className="font-bold text-white">{node.name}</span>
              <span className="text-slate-500">({node.code})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 font-mono text-xs">
          <Badge variant="outline" className="text-[10px] font-mono text-indigo-300 border-indigo-500/30">
            {node.category}
          </Badge>
          <span className="text-slate-400">{(node.poly_count / 1000).toFixed(0)}k Tris</span>
          <StatusBadge status={node.status} />
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-1 pl-2 border-l border-slate-800/60 ml-3">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const AssetHierarchyTree: React.FC<AssetHierarchyTreeProps> = ({ assets }) => {
  // Extract all assets that have defined hierarchy or assemble hierarchy tree
  const rootAssets = assets.filter((a) => !a.is_archived);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-emerald-400" />
            OpenUSD Stage Assembly Hierarchy Tree
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Nested prim structure, component assemblies, child sublayers, and polygon budgets
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">
          {rootAssets.length} Root Assemblies
        </span>
      </div>

      <div className="space-y-4">
        {rootAssets.map((asset) => {
          const rootNode: AssetHierarchyNode = {
            id: asset.id,
            name: asset.name,
            code: asset.code,
            category: asset.category,
            poly_count: asset.poly_count,
            status: asset.status,
            children: asset.hierarchy || [
              {
                id: `${asset.id}-sub1`,
                name: `${asset.name} - Primary Sub-Assembly`,
                code: `${asset.code}_SUB1`,
                category: asset.category,
                poly_count: Math.round(asset.poly_count * 0.7),
                status: asset.status,
              },
              {
                id: `${asset.id}-sub2`,
                name: `${asset.name} - Detailing & Rigging Points`,
                code: `${asset.code}_SUB2`,
                category: 'Prop',
                poly_count: Math.round(asset.poly_count * 0.3),
                status: asset.status,
              },
            ],
          };

          return (
            <div key={asset.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-white">{asset.project_code}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">{asset.code}</span>
                </div>

                <Link to={`/assets/${asset.id}`}>
                  <button className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    Open Workspace <ExternalLink className="w-3 h-3" />
                  </button>
                </Link>
              </div>

              <TreeNode node={rootNode} level={0} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
