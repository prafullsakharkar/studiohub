import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCode,
  Download,
  UploadCloud,
  Layers,
  Terminal,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { Asset } from '@/types/assets';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface AssetPublishingTabProps {
  asset: Asset;
}

export const AssetPublishingTab: React.FC<AssetPublishingTabProps> = ({ asset }) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationRunTime, setValidationRunTime] = useState<string | null>(null);

  const usdCompositionLayers = [
    {
      layer: 'Root Asset Stage',
      file: `${asset.code.toLowerCase()}.usd`,
      type: 'OpenUSD Stage Composition',
      purpose: 'Master Prim Container & Variant Sets',
      status: 'Active',
    },
    {
      layer: 'Geometry Payload',
      file: `${asset.code.toLowerCase()}_geo.usdc`,
      type: 'SubD Mesh & LODs',
      purpose: 'LOD0-LOD3 Quads, Topology & UVs',
      status: 'Synced',
    },
    {
      layer: 'LookDev & Materials',
      file: `${asset.code.toLowerCase()}_mtl.usda`,
      type: 'MaterialX Networks',
      purpose: 'ACEScg Shaders, UDIM Bindings',
      status: 'Synced',
    },
    {
      layer: 'Skeletal Rigging',
      file: `${asset.code.toLowerCase()}_rig.usdc`,
      type: 'USD Skel Schema',
      purpose: 'Joint Hierarchy, Blendshapes & Weights',
      status: 'Synced',
    },
  ];

  const pyblishChecks = [
    { name: 'USD Schema Compliance', rule: 'pxr.UsdGeom conforms to strict Pixar standards', status: 'Passed' },
    { name: 'Topology & Manifold Check', rule: 'Zero non-manifold edges, zero lamina faces', status: 'Passed' },
    { name: 'UV UDIM Bounds', rule: 'UDIM tiles bounded between 1001-1064 without overlap', status: 'Passed' },
    { name: 'MaterialX Color Profile', rule: 'All textures tagged with ACEScg or raw color spaces', status: 'Passed' },
    { name: 'Bounding Box Precision', rule: 'Prim extent attributes written to layer root', status: 'Passed' },
  ];

  const handleRunPyblish = () => {
    setIsValidating(true);
    setTimeout(() => {
      setIsValidating(false);
      setValidationRunTime(new Date().toLocaleTimeString());
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            OpenUSD Publishing Pipeline & Pyblish QC
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Stage composition sublayers, automated Pyblish validators, and USDA/USDZ exports
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunPyblish}
            isLoading={isValidating}
            leftIcon={<RefreshCw className="w-3.5 h-3.5 text-cyan-400" />}
          >
            Run Pyblish QC
          </Button>

          <Button
            size="sm"
            variant="primary"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={() => alert(`Exporting master OpenUSD package (.usdz) for ${asset.code}`)}
          >
            Export USDZ Archive
          </Button>
        </div>
      </div>

      {/* USD Composition Hierarchy Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            OpenUSD Composition Layer Stack
          </h4>
          <span className="text-[11px] font-mono text-cyan-300">
            Prim: {asset.usd_prim_path || `/World/Assets/${asset.code}`}
          </span>
        </div>

        <div className="divide-y divide-slate-800/60 font-mono text-xs">
          {usdCompositionLayers.map((layer, idx) => (
            <div key={layer.file} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                  L{idx}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white">{layer.layer}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-emerald-400 text-[11px]">{layer.file}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans mt-0.5">{layer.purpose}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-center">
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] rounded font-semibold">
                  {layer.status}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => alert(`Inspecting USD layer ${layer.file}`)}
                >
                  Inspect Layer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pyblish Automated Validators */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Pyblish Preflight Validation Suite
            </h4>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Last Validated: {validationRunTime || '2026-08-20 14:30:12'}
          </span>
        </div>

        <div className="space-y-2">
          {pyblishChecks.map((check) => (
            <div
              key={check.name}
              className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs font-mono"
            >
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-slate-200 font-bold block">{check.name}</span>
                  <span className="text-slate-400 text-[11px] font-sans">{check.rule}</span>
                </div>
              </div>

              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                {check.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Terminal / DCC Output Log */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
          <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
            <Terminal className="w-3.5 h-3.5" />
            Pyblish Pipeline Output Log
          </span>
          <span className="text-[10px] text-slate-500">pxr.usd 23.11</span>
        </div>

        <div className="text-[11px] text-slate-400 space-y-1 pt-1 leading-relaxed">
          <p className="text-slate-500">[INFO] Stage root initialized: @studio/shows/{asset.project_code}/assets/{asset.code.toLowerCase()}/master.usd@</p>
          <p className="text-slate-400">[INFO] Resolving sublayer payloads from DCC export cache...</p>
          <p className="text-emerald-400">[SUCCESS] Mesh hierarchy conforms to UsdGeomMesh schema.</p>
          <p className="text-emerald-400">[SUCCESS] MaterialX shader network bindings resolved without dangling inputs.</p>
          <p className="text-indigo-400">[INFO] Published release pointer committed to project catalog.</p>
        </div>
      </div>
    </div>
  );
};
