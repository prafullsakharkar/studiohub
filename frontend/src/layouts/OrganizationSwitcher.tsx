import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Globe,
  Star,
  Clock,
  Search,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrganization } from '@/core/organization/useOrganization';
import { cn } from '@/shared/utils/cn';

export const OrganizationSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    currentOrganization,
    organizations,
    switchOrganization,
    isLoading,
    favoriteOrgIds,
    recentOrgIds,
    toggleFavorite,
  } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredOrgs = organizations.filter(
    (o) =>
      (o.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.headquarters || '').toLowerCase().includes(search.toLowerCase())
  );

  const favoriteOrgs = organizations.filter((o) => favoriteOrgIds.includes(o.id));
  const recentOrgs = recentOrgIds
    .map((id) => organizations.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="org-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left group',
          'bg-slate-950/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200',
          compact ? 'px-2 py-1' : ''
        )}
        title="Switch Studio Organization Tenancy"
      >
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shrink-0 overflow-hidden shadow-xs ring-1 ring-white/10">
          {currentOrganization.logo_url ? (
            <img src={currentOrganization.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-3 h-3" />
          )}
        </div>

        {!compact && (
          <div className="flex flex-col min-w-0 max-w-[90px] sm:max-w-[130px] md:max-w-[160px]">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-bold text-xs text-white truncate">{currentOrganization.name}</span>
              <span className="hidden sm:inline-block text-[9px] font-mono text-indigo-400 bg-indigo-950/80 px-1 rounded border border-indigo-500/30 shrink-0">
                {currentOrganization.code}
              </span>
            </div>
            <span className="hidden md:flex text-[9px] text-slate-400 truncate items-center gap-1 font-mono">
              <Globe className="w-2.5 h-2.5 text-slate-500 shrink-0" />
              <span className="truncate">{(currentOrganization.headquarters || '').split(',')[0]} • {(currentOrganization.tier || '').replace('Enterprise ', '')}</span>
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

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95">
          {/* Header & Quick Action */}
          <div className="px-2 py-1.5 border-b border-slate-800/80 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              Studio Tenancies
            </span>
            <Link
              to="/organizations/new"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>New Studio</span>
            </Link>
          </div>

          {/* Search Input */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search studio name, code, HQ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-3 custom-scrollbar pr-0.5">
            {/* Search Results */}
            {search.trim() ? (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase text-slate-500 px-2 py-0.5">Matching Studios</div>
                {filteredOrgs.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">No organizations match "{search}"</div>
                ) : (
                  filteredOrgs.map((org) => (
                    <OrgItem
                      key={org.id}
                      org={org}
                      isSelected={org.id === currentOrganization.id}
                      isFavorite={favoriteOrgIds.includes(org.id)}
                      onSelect={() => {
                        switchOrganization(org.id);
                        setIsOpen(false);
                      }}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        toggleFavorite(org.id);
                      }}
                    />
                  ))
                )}
              </div>
            ) : (
              <>
                {/* Favorites Section */}
                {favoriteOrgs.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-amber-400/90 px-2 py-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>Favorite Studios</span>
                    </div>
                    {favoriteOrgs.map((org) => (
                      <OrgItem
                        key={`fav-${org.id}`}
                        org={org}
                        isSelected={org.id === currentOrganization.id}
                        isFavorite={true}
                        onSelect={() => {
                          switchOrganization(org.id);
                          setIsOpen(false);
                        }}
                        onToggleFavorite={(e) => {
                          e.stopPropagation();
                          toggleFavorite(org.id);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Recents Section */}
                {recentOrgs.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-slate-500 px-2 py-0.5">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Recent</span>
                    </div>
                    {recentOrgs.map((org) => (
                      <OrgItem
                        key={`rec-${org.id}`}
                        org={org}
                        isSelected={org.id === currentOrganization.id}
                        isFavorite={favoriteOrgIds.includes(org.id)}
                        onSelect={() => {
                          switchOrganization(org.id);
                          setIsOpen(false);
                        }}
                        onToggleFavorite={(e) => {
                          e.stopPropagation();
                          toggleFavorite(org.id);
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* All Studios Section */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-500 px-2 py-0.5">
                    <span>All Studios ({organizations.length})</span>
                    <Link
                      to="/organizations"
                      onClick={() => setIsOpen(false)}
                      className="text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Manage</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                  {organizations.map((org) => (
                    <OrgItem
                      key={`all-${org.id}`}
                      org={org}
                      isSelected={org.id === currentOrganization.id}
                      isFavorite={favoriteOrgIds.includes(org.id)}
                      onSelect={() => {
                        switchOrganization(org.id);
                        setIsOpen(false);
                      }}
                      onToggleFavorite={(e) => {
                        e.stopPropagation();
                        toggleFavorite(org.id);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer view all link */}
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between px-2 text-xs">
            <Link
              to="/organizations"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
            >
              <span>Organization Directory</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/organizations/new');
              }}
              className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] flex items-center gap-1"
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

interface OrgItemProps {
  org: any;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

const OrgItem: React.FC<OrgItemProps> = ({ org, isSelected, isFavorite, onSelect, onToggleFavorite }) => {
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
        <img
          src={org.logo_url}
          alt=""
          className="w-7 h-7 rounded-md object-cover ring-1 ring-slate-700 shrink-0"
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs truncate">{org.name}</span>
            <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
              {org.code}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>{(org.headquarters || '').split(',')[0]}</span>
            <span>•</span>
            <span className="text-slate-500">{org.crew_count ?? 0} Crew</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleFavorite}
          className="p-1 rounded hover:bg-slate-700/80 text-slate-500 hover:text-amber-400 transition-colors"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={cn('w-3.5 h-3.5', isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-600')} />
        </button>
        {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
      </div>
    </div>
  );
};
