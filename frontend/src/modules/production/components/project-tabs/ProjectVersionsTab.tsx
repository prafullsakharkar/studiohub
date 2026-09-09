import React, { useState } from 'react';
import {
  History,
  Search,
  Download,
  ExternalLink,
  Film,
  Box,
  FileCode,
  CheckCircle2,
  Clock,
  PlaySquare,
  Sparkles,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { usePublishedVersions } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectVersionsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectVersionsTab: React.FC<ProjectVersionsTabProps> = ({
  project,
  onNavigateTab,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Shot' | 'Asset'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: versionsData, isLoading } = usePublishedVersions({ search });
  const allVersions = versionsData?.results || [];

  // Filter scoped to this project
  const projectVersions = allVersions.filter(
    (v) =>
      v.project_id === project.id ||
      v.project_code?.toLowerCase() === project.code.toLowerCase() ||
      v.file_path?.includes(project.code)
  );

  const filtered = projectVersions.filter((v) => {
    const matchType = typeFilter === 'ALL' || v.entity_type === typeFilter;
    const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchType && matchStatus;
  });

  const handleDownloadManifest = (v: any) => {
    addNotification({
      type: 'info',
      title: 'Payload Manifest Exported',
      message: `OpenUSD JSON manifest for ${v.entity_code} (${v.version_number}) downloaded.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search published passes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1">
            {(['ALL', 'Shot', 'Asset'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  typeFilter === type
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {type === 'ALL' ? 'All' : `${type}s`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => onNavigateTab('reviews')}
            leftIcon={<PlaySquare className="w-3.5 h-3.5" />}
          >
            Screening Room
          </Button>

          <Link to="/versions">
            <Button size="sm" variant="ghost" rightIcon={<ExternalLink className="w-3 h-3" />}>
              Global Versions
            </Button>
          </Link>
        </div>
      </div>

      {/* Published Versions List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                <th className="py-2.5 px-3">Entity & Version</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Stage / NAS File Path</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Publisher</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 font-mono text-xs">
                        {v.entity_type === 'Shot' ? <Film className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white">{v.entity_code}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                            {v.version_number}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{v.frame_range}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">{v.entity_type}</td>
                  <td className="py-2.5 px-3 text-slate-300">{v.department}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-mono text-[11px] text-slate-400 truncate max-w-xs block" title={v.file_path}>
                      {v.file_path}
                    </div>
                    {v.usd_stage_path && (
                      <div className="font-mono text-[10px] text-purple-400 truncate max-w-xs block mt-0.5" title={v.usd_stage_path}>
                        USD: {v.usd_stage_path}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        v.status === 'Approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-200">
                    <div className="flex items-center gap-1.5">
                      {v.published_by_avatar && (
                        <img src={v.published_by_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                      )}
                      <span className="truncate">{v.published_by_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleDownloadManifest(v)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-300"
                      title="Download Manifest"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-slate-500 font-mono">
                    No published OpenUSD or EXR versions found for this show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
