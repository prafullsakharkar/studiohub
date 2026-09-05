import React, { useState } from 'react';
import { Film, Plus, Search, ExternalLink, Calendar, Users, DollarSign, Layers, CheckCircle2, X } from 'lucide-react';
import { Client } from '@/types/organization';
import { Project } from '@/types/projects';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Link } from 'react-router-dom';
import { useClientMutations } from '../../hooks/useOrganizationData';

interface ClientProjectsTabProps {
  client: Client;
}

export const ClientProjectsTab: React.FC<ClientProjectsTabProps> = ({ client }) => {
  const [activeProjectsList, setActiveProjectsList] = useState<string[]>(client.active_projects || []);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [customProjectCode, setCustomProjectCode] = useState('');

  const { updateClient } = useClientMutations();
  const { data: projectsData } = useProjects();
  const allProjects: Project[] = projectsData?.results ?? [];

  // Find full Project objects that match active_projects or client_name
  const associatedProjects = allProjects.filter((p) =>
    activeProjectsList.some(
      (codeOrName) =>
        p.code.toLowerCase() === codeOrName.toLowerCase() ||
        codeOrName.toLowerCase().includes(p.code.toLowerCase()) ||
        p.client_name?.toLowerCase() === client.name.toLowerCase()
    )
  );

  const filteredProjects = associatedProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssociateProject = (e: React.FormEvent) => {
    e.preventDefault();
    let codeToAdd = customProjectCode.trim();
    if (selectedProjectId) {
      const proj = allProjects.find((p) => p.id === selectedProjectId);
      if (proj) {
        codeToAdd = `${proj.code} (${proj.name})`;
      }
    }

    if (!codeToAdd || activeProjectsList.includes(codeToAdd)) return;

    const updated = [...activeProjectsList, codeToAdd];
    setActiveProjectsList(updated);
    updateClient.mutate({
      id: client.id,
      data: { active_projects: updated },
    });

    setIsAddModalOpen(false);
    setSelectedProjectId('');
    setCustomProjectCode('');
  };

  const handleRemoveProject = (projectCode: string) => {
    const updated = activeProjectsList.filter(
      (item) => !item.toLowerCase().includes(projectCode.toLowerCase())
    );
    setActiveProjectsList(updated);
    updateClient.mutate({
      id: client.id,
      data: { active_projects: updated },
    });
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            Associated Productions ({associatedProjects.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Productions where {client.name} is the executive contracting client entity (N:M relationship).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search shows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-48 font-mono"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Project
          </Button>
        </div>
      </div>

      {/* Projects List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
            No projects associated with this client studio.
          </div>
        ) : (
          filteredProjects.map((project) => {
            const completionPercent = Math.round(
              (project.approved_shots / (project.total_shots || 1)) * 100
            );

            return (
              <div
                key={project.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-colors group"
              >
                <div>
                  {/* Thumbnail & Header Banner */}
                  <div className="relative h-28 w-full bg-slate-950 overflow-hidden">
                    <img
                      src={project.thumbnail_url}
                      alt={project.name}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                    
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs text-white bg-slate-950/80 border-slate-700">
                        {project.code}
                      </Badge>
                      <Badge
                        variant={
                          project.status === 'In Progress'
                            ? 'success'
                            : project.status === 'Pending Review'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {project.status}
                      </Badge>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3">
                      <h4 className="font-bold text-sm text-white drop-shadow-xs">{project.name}</h4>
                      <span className="text-[11px] text-slate-300 font-mono">{project.type}</span>
                    </div>
                  </div>

                  {/* Body Specs */}
                  <div className="p-4 space-y-3.5">
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400">
                          Shots: {project.approved_shots}/{project.total_shots} ({project.in_progress_shots} in progress)
                        </span>
                        <span className="text-emerald-400 font-bold">{completionPercent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Specs Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-slate-500">Supervisor:</span>{' '}
                        <span className="text-slate-200">{project.supervisor_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Coordinator:</span>{' '}
                        <span className="text-slate-200">{project.coordinator_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Format:</span>{' '}
                        <span className="text-slate-200">{project.resolution} • {project.fps}fps</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Color:</span>{' '}
                        <span className="text-slate-200">{project.color_space}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Delivery:</span>{' '}
                        <span className="text-indigo-300 font-bold">{project.delivery_date}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Budget:</span>{' '}
                        <span className="text-emerald-400 font-bold">
                          ${(project.budget_usd / 1000000).toFixed(2)}M
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 pt-0 flex items-center justify-between border-t border-slate-800/60 mt-2">
                  <button
                    onClick={() => handleRemoveProject(project.code)}
                    className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Unlink Show
                  </button>

                  <Link
                    to={`/projects`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    Open Production Workspace <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Link Project Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                Associate Production to Client
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssociateProject} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono text-slate-400">
                  Select Existing Organization Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setCustomProjectCode('');
                  }}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Organization Show --</option>
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-2 text-[10px] text-slate-500 uppercase font-mono">
                  OR custom show slate code
                </span>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400">
                  Custom Production Slate Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. MK42 (Mecha Prime Origins)"
                  value={customProjectCode}
                  onChange={(e) => {
                    setCustomProjectCode(e.target.value);
                    setSelectedProjectId('');
                  }}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Associate Show
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
