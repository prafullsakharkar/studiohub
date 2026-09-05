import React from 'react';
import {
  Terminal,
  Cpu,
  Layers,
  Settings,
  HardDrive,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
  Flame,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { Badge } from '@/shared/components/Badge';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectPipelineTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectPipelineTab: React.FC<ProjectPipelineTabProps> = ({ project }) => {
  const addNotification = useNotificationStore((state) => state.addNotification);

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    addNotification({
      type: 'info',
      title: 'Path Copied to Clipboard',
      message: path,
    });
  };

  const softwareStack = [
    { name: 'Autodesk Maya', version: '2024.2', plugin: 'MtoA 5.3.4 (Arnold 7.3.1)', use: 'Hero Asset Modeling & Rigging' },
    { name: 'SideFX Houdini', version: '20.5.332', plugin: 'Karma XPU & Solaris USD', use: 'Volumetric Pyro, Water & Crowd Sim' },
    { name: 'Foundry NukeX', version: '15.0v2', plugin: 'Cryptomatte & Deep Compositing', use: 'Final 16-bit OpenEXR Finishing' },
    { name: 'Pixar OpenUSD', version: '24.08', plugin: 'USD Hydra Viewport 2.0', use: 'Stage Payloads & Asset Composition' },
    { name: 'MaterialX', version: '1.38.8', plugin: 'Standard Surface ACEScg', use: 'Physically Based LookDev Shaders' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            Show Technical Envelope & OpenUSD Pipeline Configuration
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Environment definitions, storage filesystem mount points, and DCC plugin dependencies for <strong className="text-white font-mono">{project.name} ({project.code})</strong>
          </p>
        </div>
      </div>

      {/* 2-Column Technical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Color & Image Specs */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            Color Science & Framing Parameters
          </h4>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Master Color Space</span>
              <span className="font-bold text-indigo-400">{project.color_space} (Linear ACES 1.3)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">OCIO Config Version</span>
              <span className="font-bold text-white">OCIO v2.1.2 (Studio Reference)</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Master DCI Resolution</span>
              <span className="font-bold text-white">{project.resolution}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Native Project Framerate</span>
              <span className="font-bold text-white">{project.fps} FPS Progressive</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Theatrical Aspect Ratio</span>
              <span className="font-bold text-white">{project.aspect_ratio || '2.39:1'} (Cinemascope)</span>
            </div>
          </div>
        </div>

        {/* Right: Storage & NAS Mounts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            Filesystem Mount Points & USD Hierarchy
          </h4>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Show Root Mount Point:</span>
                <button
                  onClick={() => copyPath(`/nas/shows/${project.code.toLowerCase()}`)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <span className="font-bold text-white block truncate">/nas/shows/{project.code.toLowerCase()}</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">OpenUSD Stage Hierarchy Prim:</span>
                <button
                  onClick={() => copyPath(`/world/${project.code.toLowerCase()}`)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <span className="font-bold text-purple-400 block truncate">/world/{project.code.toLowerCase()}</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Render Farm High-IO Cache:</span>
                <button
                  onClick={() => copyPath(`/cache/farm/${project.code.toLowerCase()}`)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <span className="font-bold text-emerald-400 block truncate">/cache/farm/{project.code.toLowerCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Software & DCC Plugin Matrix */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
          <Settings className="w-3.5 h-3.5 text-amber-400" />
          Production Software Stack & DCC Environment
        </h4>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                <th className="py-2 px-3">DCC Software Package</th>
                <th className="py-2 px-3">Version</th>
                <th className="py-2 px-3">Renderer / Pipeline Plugin</th>
                <th className="py-2 px-3">Discipline Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {softwareStack.map((s) => (
                <tr key={s.name} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-white">{s.name}</td>
                  <td className="py-2.5 px-3 text-indigo-300">{s.version}</td>
                  <td className="py-2.5 px-3 text-slate-300">{s.plugin}</td>
                  <td className="py-2.5 px-3 text-slate-400 font-sans text-xs">{s.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
