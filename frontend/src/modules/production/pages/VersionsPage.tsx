import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  Film,
  Box,
  Layers,
  FileCode,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  PlaySquare,
  Sparkles,
} from 'lucide-react';
import { usePublishedVersions } from '@/modules/organization/hooks/useOrganizationData';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';
import { Link } from 'react-router-dom';

export const VersionsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Shot' | 'Asset'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: versionsData, isLoading } = usePublishedVersions({ search });
  const versions = versionsData?.results || [];

  const filtered = versions.filter((v) => {
    const matchType = typeFilter === 'ALL' || v.entity_type === typeFilter;
    const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchType && matchStatus;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Published Versions & OpenUSD Payloads</h1>
            <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
              {versions.length} Published Passes
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable OpenUSD asset stages, multi-channel EXR render sequences, and supervisor approval logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search version code or path..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 w-56"
            />
          </div>

          <Link to="/reviews">
            <Button size="sm" variant="primary" leftIcon={<PlaySquare className="w-3.5 h-3.5" />}>
              Open Screening Room
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          {(['ALL', 'Shot', 'Asset'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                typeFilter === type
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {type === 'ALL' ? 'All Published Entities' : `${type}s`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'Approved', 'Pending Review'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all',
                statusFilter === status
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Versions List */}
      <div className="space-y-3">
        {filtered.map((version) => (
          <div
            key={version.id}
            className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <img
                src={version.thumbnail_url}
                alt=""
                className="w-24 h-16 rounded-lg object-cover ring-1 ring-slate-800 shrink-0 bg-slate-950"
              />

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white font-mono">{version.entity_code}</span>
                  <span className="px-1.5 py-0.2 rounded bg-indigo-950 font-mono text-xs font-bold text-indigo-400 border border-indigo-500/30">
                    {version.version_number}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {version.department}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-mono',
                      version.status === 'Approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    )}
                  >
                    {version.status}
                  </Badge>
                </div>

                <p className="text-xs text-slate-300 line-clamp-1">{version.notes}</p>

                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                  <span>Frames: {version.frame_range}</span>
                  <span>•</span>
                  <span>Size: {(version.file_size_mb / 1024).toFixed(2)} GB</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <img
                      src={version.published_by_avatar}
                      alt=""
                      className="w-3.5 h-3.5 rounded-full object-cover"
                    />
                    {version.published_by_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Paths */}
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                onClick={() => navigator.clipboard.writeText(version.file_path)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-[11px] font-mono text-slate-300 border border-slate-800 transition-colors"
                title="Copy EXR / USD Path to Clipboard"
              >
                Copy Path
              </button>
              <Link to="/reviews">
                <Button size="sm" variant="outline" leftIcon={<PlaySquare className="w-3.5 h-3.5" />}>
                  Inspect in Dailies
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
