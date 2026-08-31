import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Film,
  ChevronDown,
  Search,
  Check,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Plus,
  Radio,
  ExternalLink,
} from 'lucide-react';
import type { Project } from '@/mocks/db/production/projects';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { useProductionStore, useActiveProject } from '@/core/production/useProductionStore';
import { StatusBadge } from '@/shared/components/StatusBadge';

export const ProjectSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { activeProjectId, setActiveProject } = useProductionStore();
  const { project: activeProject } = useActiveProject();
  const { data: projectsData } = useProjects({ page_size: 100 });
  const projects = projectsData?.results ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProject = (project: Project) => {
    setActiveProject(project.id);
    setIsOpen(false);

    // If currently inside a project workspace, navigate to new project
    if (location.pathname.startsWith('/projects/')) {
      navigate(`/projects/${project.id}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Project Switcher Trigger */}
      <button
        type="button"
        id="project-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition-colors group cursor-pointer shrink-0 min-w-0"
        title="Switch active production show context"
      >
        <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:text-indigo-300 transition-colors" />
        <span className="font-bold text-white font-mono text-xs shrink-0">[{activeProject?.code || 'SHOW'}]</span>
        <span className="hidden md:inline font-medium text-slate-300 truncate max-w-[90px] lg:max-w-[130px]">
          {activeProject?.name || 'Production Show'}
        </span>
        <span className="hidden 2xl:inline text-[10px] text-slate-400 font-mono px-1 bg-slate-900 rounded border border-slate-800 shrink-0">
          {activeProject?.fps || 24}fps
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Switcher Dropdown Modal */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-84 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
          {/* Header & Search */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider font-mono">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Active Production Context
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {projects.length} shows registered
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search production by name, code or client..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                autoFocus
              />
            </div>
          </div>

          {/* Project List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/50 custom-scrollbar p-1">
            {filteredProjects.map((p) => {
              const isSelected = p.id === activeProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProject(p)}
                  className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-950/40 border border-indigo-500/30 text-white'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono text-xs font-bold text-indigo-400 shrink-0">
                      {p.code}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{p.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                            Active Context
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{p.client_name}</span>
                        <span>•</span>
                        <span>{p.fps} FPS</span>
                        <span>•</span>
                        <span>{p.color_space}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={p.status} />
                    {isSelected && <Check className="w-4 h-4 text-indigo-400 mt-1" />}
                  </div>
                </div>
              );
            })}

            {filteredProjects.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">
                No active productions match &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/projects');
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-indigo-400 font-mono transition-colors"
            >
              <span>View All Productions</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/projects/new');
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[11px] font-semibold transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>New Show</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
