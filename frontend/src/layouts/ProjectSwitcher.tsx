import { useProjects } from '@/modules/production';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Film,
  ChevronDown,
  Search,
  Check,
  Star,
  Clock,
  Plus,
  ExternalLink,
  Layers,
  ArrowRight,
  Clapperboard,
  Loader2,
} from 'lucide-react';
import { useProductionStore } from '@/core/production/useProductionStore';
import type { Project } from '@/api/production/structure';
import { useAuth } from '@/modules/auth';
import { filterAccessibleProjects, isSuperAdminUser } from '@/core/permissions/accessControl';
import { cn } from '@/shared/utils/cn';

export const ProjectSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { user, can } = useAuth();
  const { data: projectsData, isLoading } = useProjects();

  const availableProjects: Project[] = useMemo(() => {
    if (!user) return [];
    // Fixture fallback is mock-engine only: in REST mode the backend list
    // is the sole source of truth, so empty results mean no projects —
    // never mock ids Django cannot resolve.
    const sourceList: Project[] = projectsData?.results ?? [];

    return filterAccessibleProjects(user, sourceList);
  }, [projectsData?.results, user]);

  const {
    activeProjectId,
    setActiveProject,
    recentProjectIds,
    favoriteProjectIds,
    toggleFavoriteProject,
  } = useProductionStore();

  // Find active project entity belonging to current organization
  const activeProject = useMemo(() => {
    return availableProjects.find((p) => p.id === activeProjectId) || availableProjects[0] || null;
  }, [availableProjects, activeProjectId]);

  // Keep activeProjectId synchronized with available projects
  useEffect(() => {
    if (!isLoading) {
      if (availableProjects.length === 0) {
        if (activeProjectId) {
          setActiveProject('');
        }
      } else {
        const isCurrentInAvailable = availableProjects.some((p) => p.id === activeProjectId);
        if (!isCurrentInAvailable) {
          const firstProj = availableProjects[0];
          setActiveProject(firstProj.id);
        }
      }
    }
  }, [availableProjects, activeProjectId, isLoading, setActiveProject]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredProjects = availableProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.type?.toLowerCase().includes(search.toLowerCase())
  );

  const favoriteProjects = availableProjects.filter((p) =>
    favoriteProjectIds?.includes(p.id)
  );

  const recentProjects = (recentProjectIds || [])
    .map((id) => availableProjects.find((p) => p.id === id))
    .filter((p): p is Project => Boolean(p));

  const handleSelectProject = (project: Project) => {
    setActiveProject(project.id);
    setIsOpen(false);

    // If currently inside a project workspace, navigate to new project
    if (location.pathname.startsWith('/projects/')) {
      navigate(`/projects/${project.id}`);
    }
  };

  const isSuper = isSuperAdminUser(user);
  const canSwitchProject = isSuper || can('project.create') || availableProjects.length > 1;

  if (availableProjects.length === 0) {
    return (
      <div
        id="project-empty-badge"
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border select-none',
          'bg-slate-950/80 border-slate-800/80 text-slate-500',
          compact ? 'px-2 py-1' : ''
        )}
        title="No project access"
      >
        <Film className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-medium text-slate-400">No Projects</span>
      </div>
    );
  }

  if (!canSwitchProject && availableProjects.length === 1) {
    return (
      <div
        id="project-static-badge"
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border select-none',
          'bg-slate-950/80 border-slate-800/80 text-slate-200',
          compact ? 'px-2 py-1' : ''
        )}
        title={`Assigned Project: ${activeProject?.name}`}
      >
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shrink-0 overflow-hidden shadow-xs ring-1 ring-white/10">
          {activeProject?.thumbnail_url ? (
            <SmartImg src={activeProject.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film className="w-3 h-3" />
          )}
        </div>
        {!compact && (
          <div className="flex flex-col min-w-0 max-w-[120px]">
            <span className="font-bold text-xs text-white truncate">
              {activeProject?.name}
            </span>
            <span className="text-[9px] font-mono text-indigo-400">
              {activeProject?.code}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button Matching Organization Switcher Style */}
      <button
        type="button"
        id="project-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left group cursor-pointer select-none',
          'bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-indigo-500/40 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50',
          compact ? 'px-2 py-1' : ''
        )}
        title="Switch Active Production Show"
      >
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shrink-0 overflow-hidden shadow-xs ring-1 ring-white/10">
          {activeProject?.thumbnail_url ? (
            <SmartImg src={activeProject.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Film className="w-3 h-3" />
          )}
        </div>

        {!compact && (
          <div className="flex flex-col min-w-0 max-w-[70px] sm:max-w-[120px] md:max-w-[150px]">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-bold text-xs text-white truncate">
                {activeProject?.name || 'Select Show'}
              </span>
              <span className="hidden md:inline-block text-[9px] font-mono text-indigo-400 bg-indigo-950/80 px-1 rounded border border-indigo-500/30 shrink-0">
                {activeProject?.code || 'SHOW'}
              </span>
            </div>
            <span className="hidden lg:flex text-[9px] text-slate-400 truncate items-center gap-1 font-mono">
              <Clapperboard className="w-2.5 h-2.5 text-slate-500 shrink-0" />
              <span className="truncate">
                {activeProject?.client_name || activeProject?.type || 'Feature Film'} • {activeProject?.fps || 24}fps
              </span>
            </span>
          </div>
        )}

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-transform ml-1',
            isOpen ? 'rotate-180 text-indigo-400' : ''
          )}
        />
      </button>

      {/* Dropdown Menu Matching Organization Switcher Layout */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 sm:w-88 max-w-[calc(100vw-1.5rem)] rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95">
          {/* Header & Quick Action */}
          <div className="px-2 py-1.5 border-b border-slate-800/80 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-indigo-400" />
              Productions
            </span>
            <Link
              to="/projects/new"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>New Show</span>
            </Link>
          </div>

          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search show title, code, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-sans"
            />
          </div>

          {/* Scrollable Project Items */}
          <div className="max-h-72 overflow-y-auto space-y-3 custom-scrollbar pr-0.5">
            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-xs font-mono">Loading shows...</span>
              </div>
            ) : search.trim() ? (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase text-slate-500 px-2 py-0.5">
                  Matching Productions
                </div>
                {filteredProjects.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">
                    No productions match "{search}"
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <ProjectItem
                      key={project.id}
                      project={project}
                      isSelected={project.id === activeProjectId}
                      isFavorite={favoriteProjectIds?.includes(project.id)}
                      onSelect={() => handleSelectProject(project)}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        toggleFavoriteProject(project.id);
                      }}
                    />
                  ))
                )}
              </div>
            ) : (
              <>
                {/* Favorites Section */}
                {favoriteProjects.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-amber-400/90 px-2 py-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>Favorite Productions</span>
                    </div>
                    {favoriteProjects.map((project) => (
                      <ProjectItem
                        key={`fav-${project.id}`}
                        project={project}
                        isSelected={project.id === activeProjectId}
                        isFavorite={true}
                        onSelect={() => handleSelectProject(project)}
                        onToggleFavorite={(e) => {
                          e.stopPropagation();
                          toggleFavoriteProject(project.id);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Recents Section */}
                {recentProjects.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-slate-500 px-2 py-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Recent</span>
                    </div>
                    {recentProjects.map((project) => (
                      <ProjectItem
                        key={`rec-${project.id}`}
                        project={project}
                        isSelected={project.id === activeProjectId}
                        isFavorite={favoriteProjectIds?.includes(project.id)}
                        onSelect={() => handleSelectProject(project)}
                        onToggleFavorite={(e) => {
                          e.stopPropagation();
                          toggleFavoriteProject(project.id);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* All Productions Section */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-500 px-2 py-0.5">
                    <span>All Productions ({availableProjects.length})</span>
                    <Link
                      to="/projects"
                      onClick={() => setIsOpen(false)}
                      className="text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Manage</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                  {availableProjects.map((project) => (
                    <ProjectItem
                      key={`all-${project.id}`}
                      project={project}
                      isSelected={project.id === activeProjectId}
                      isFavorite={favoriteProjectIds?.includes(project.id)}
                      onSelect={() => handleSelectProject(project)}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        toggleFavoriteProject(project.id);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer View All / Create */}
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between px-2 text-xs">
            <Link
              to="/projects"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
            >
              <Layers className="w-3 h-3" />
              <span>Productions Directory</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/projects/new');
              }}
              className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Create</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ProjectItemProps {
  project: Project;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({
  project,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between gap-2 cursor-pointer group',
        isSelected
          ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-xs'
          : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center font-mono text-xs font-bold text-indigo-400 shrink-0 overflow-hidden ring-1 ring-slate-700">
          {project.thumbnail_url ? (
            <SmartImg src={project.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{project.code.slice(0, 3)}</span>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs truncate max-w-[130px] sm:max-w-[160px]">
              {project.name}
            </span>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded shrink-0">
              {project.code}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="truncate max-w-[110px]">{project.client_name || project.type || 'Feature Film'}</span>
            <span>•</span>
            <span className="text-slate-500 font-mono shrink-0">{project.fps} FPS</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggleFavorite}
          className="p-1 rounded hover:bg-slate-700/80 text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            className={cn(
              'w-3.5 h-3.5',
              isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
            )}
          />
        </button>
        {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
      </div>
    </div>
  );
};
