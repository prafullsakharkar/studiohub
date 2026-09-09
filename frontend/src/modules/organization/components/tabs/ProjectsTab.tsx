import React from 'react';
import {
  Film,
  Plus,
  ArrowUpRight,
  Clapperboard,
  Box,
  CheckSquare,
  Eye,
  Layers,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { Organization } from '@/types/organization';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';

export const ProjectsTab: React.FC<{ org: Organization }> = ({ org }) => {
  const { data: projectsData, isLoading } = useProjects();
  const navigate = useNavigate();
  const { openTab } = useWorkspaceStore();

  const projects = projectsData?.results || [];

  const handleOpenInWorkspace = (p: any) => {
    openTab(
      {
        id: p.id,
        title: p.name,
        type: 'project',
        code: p.code,
        thumbnail_url: p.thumbnail_url,
      },
      p.name
    );
    navigate('/workspace');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            Active Production Shows & Cinematic Projects
          </h2>
          <p className="text-xs text-slate-400">
            Real-time access to production modules: Shots, Assets, Tasks, Versions, and Review screening rooms.
          </p>
        </div>

        <Link to="/projects/new">
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Spawn New Show
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-mono">
          Loading synchronized show pipelines...
        </div>
      ) : projects.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/60 border border-slate-800">
          <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Active Production Shows</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Initialize the first visual effects feature film or episodic series for {org.name}.
          </p>
          <Link to="/projects/new">
            <Button size="sm" variant="primary">
              Initialize Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            return (
              <div
                key={proj.id}
                className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all group shadow-xs"
              >
                {/* Project Header Banner / Thumbnail */}
                <div className="h-28 w-full relative bg-slate-950 overflow-hidden">
                  <img
                    src={
                      proj.thumbnail_url ||
                      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80'
                    }
                    alt=""
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                  <div className="absolute top-2.5 right-2.5">
                    <Badge variant="success" className="text-[9px] uppercase font-mono shadow-xs">
                      {proj.status}
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 left-3 flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold bg-indigo-950/90 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/40">
                      {proj.code}
                    </span>
                    <span className="text-xs font-mono text-slate-300">{proj.fps || 24} FPS</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-3 flex-1">
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {proj.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">{proj.description}</p>
                  </div>

                  {/* Production Module Quick Jump Links */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] uppercase font-mono text-slate-500 block mb-2">
                      Production Modules
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Link
                        to={`/shots?project_id=${proj.id}`}
                        className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-indigo-500/40 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-medium text-[11px]">Shots Tracker</span>
                      </Link>

                      <Link
                        to={`/assets?project_id=${proj.id}`}
                        className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/40 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <Box className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-medium text-[11px]">3D Assets</span>
                      </Link>

                      <Link
                        to={`/tasks?project_id=${proj.id}`}
                        className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-cyan-500/40 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-medium text-[11px]">Artist Tasks</span>
                      </Link>

                      <Link
                        to={`/reviews?project_id=${proj.id}`}
                        className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/40 text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-400" />
                        <span className="font-medium text-[11px]">Dailies Review</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Target Delivery: {proj.delivery_date ? new Date(proj.delivery_date).toLocaleDateString() : 'Q4 2026'}
                  </span>

                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleOpenInWorkspace(proj)}
                    rightIcon={<ArrowUpRight className="w-3 h-3" />}
                    className="text-[11px]"
                  >
                    Open Workspace
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
