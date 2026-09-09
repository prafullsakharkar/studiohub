import React from 'react';
import { SearchResultItem } from '@/types/intelligence';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Tag,
  Clock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

interface SearchResultCardProps {
  item: SearchResultItem;
  query?: string;
}

const ENTITY_CONFIGS: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  project: { label: 'Project', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', icon: '🎬' },
  shot: { label: 'Shot', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', icon: '🎯' },
  asset: { label: 'Asset', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', icon: '📦' },
  task: { label: 'Task', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: '✅' },
  version: { label: 'Version', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', icon: '🎞️' },
  review: { label: 'Review', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', icon: '👁️' },
  delivery: { label: 'Delivery', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', icon: '🚀' },
  knowledge: { label: 'Knowledge Hub', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20', icon: '📚' },
  person: { label: 'Person', bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', icon: '👤' },
  department: { label: 'Department', bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/20', icon: '🏢' },
  team: { label: 'Team', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20', icon: '👥' },
  vendor: { label: 'Vendor', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', icon: '🤝' },
  client: { label: 'Client', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', icon: '💼' },
  organization: { label: 'Organization', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', icon: '🏛️' },
  office: { label: 'Office', bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', icon: '📍' },
  media: { label: 'Media Plate', bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/20', icon: '🖼️' },
};

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ item }) => {
  const navigate = useNavigate();
  const cfg = ENTITY_CONFIGS[item.entity_type] || {
    label: item.entity_type,
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-700',
    icon: '📁',
  };

  const handleCardClick = () => {
    navigate(item.url);
  };

  return (
    <div
      id={`search-item-${item.id}`}
      onClick={handleCardClick}
      className="group relative flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-md cursor-pointer gap-4"
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        {/* Entity Type Badge or Thumbnail */}
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-12 h-12 rounded-lg object-cover border border-slate-800 shrink-0"
          />
        ) : (
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 border ${cfg.bg} ${cfg.border}`}
          >
            {cfg.icon}
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              {cfg.label}
            </span>

            {item.project_code && item.project_code !== 'ALL' && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-emerald-400 border border-emerald-500/30">
                {item.project_code}
              </span>
            )}

            {item.status && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950/60 text-slate-400 border border-slate-800">
                {item.status.replace(/_/g, ' ')}
              </span>
            )}

            {item.score > 5 && (
              <span className="text-[10px] text-amber-400 flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                <Sparkles className="w-2.5 h-2.5" /> High Match
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
            {item.title}
          </h3>

          {item.subtitle && (
            <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
          )}

          {item.description && (
            <p className="text-xs text-slate-400/90 line-clamp-1">{item.description}</p>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {item.tags.slice(0, 4).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800/80"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metadata & Direct Link */}
      <div className="flex items-center gap-3 self-end md:self-center shrink-0 text-slate-400">
        <div className="text-right hidden sm:block">
          <div className="text-[11px] text-slate-400 flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>
              {new Date(item.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
        <button
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-700/60 group-hover:border-indigo-500/40 transition-all cursor-pointer"
          title="Open in module view"
        >
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
