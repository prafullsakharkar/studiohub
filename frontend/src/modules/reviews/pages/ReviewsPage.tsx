import React, { useState } from 'react';
import { useReviews } from '../hooks/useReviews';
import { useReviewMutations } from '../hooks/useReviewMutations';
import { usePlaylists } from '@/modules/playlists/hooks/usePlaylists';
import { usePlaylistMutations } from '@/modules/playlists/hooks/usePlaylistMutations';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { ReviewWorkspace } from '../components/workspace/ReviewWorkspace';
import { PlaylistWorkspace } from '../components/playlists/PlaylistWorkspace';
import { CreateReviewModal } from '../components/modals/CreateReviewModal';
import { CreatePlaylistModal } from '../components/playlists/CreatePlaylistModal';
import { ReviewSession } from '@/types/reviews';
import { Playlist, PlaylistEntry } from '@/types/playlists';
import {
  Film,
  Play,
  Plus,
  Layers,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Eye,
  Building,
  UserCheck,
  Sparkles,
  Sliders,
  ListPlus,
  List,
} from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

export const ReviewsPage: React.FC = () => {
  const { user } = useAuth();

  // Top Section Mode: 'reviews' | 'playlists'
  const [mainView, setMainView] = useState<'reviews' | 'playlists'>('reviews');

  // Currently selected session or playlist for workspace view
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [playlistTypeFilter, setPlaylistTypeFilter] = useState('ALL');

  // Modals state
  const [isCreateReviewOpen, setIsCreateReviewOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);

  // Queries
  const { data: reviewsData, isLoading: isReviewsLoading } = useReviews();
  const { data: playlistsData, isLoading: isPlaylistsLoading } = usePlaylists();

  const { createReview, isCreating: isCreatingReview } = useReviewMutations();
  const { createPlaylist, isCreating: isCreatingPlaylist } = usePlaylistMutations();

  const reviews: ReviewSession[] = reviewsData?.results || [];
  const playlists: Playlist[] = playlistsData?.results || [];

  // Active items
  const activeReview = reviews.find((r) => r.id === activeReviewId);
  const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

  // If a specific Review is active, render the ReviewWorkspace
  if (activeReview) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <ReviewWorkspace
          review={activeReview}
          onBack={() => setActiveReviewId(null)}
        />
      </div>
    );
  }

  // If a specific Playlist is active, render the PlaylistWorkspace
  if (activePlaylist) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <PlaylistWorkspace
          playlist={activePlaylist}
          onBack={() => setActivePlaylistId(null)}
          onLaunchReviewSession={(entry: PlaylistEntry) => {
            // Find corresponding review or create review view
            const matchedReview = reviews.find((r) => r.entity_code === entry.entity_code);
            if (matchedReview) {
              setActivePlaylistId(null);
              setActiveReviewId(matchedReview.id);
            }
          }}
        />
      </div>
    );
  }

  // Filter Reviews
  const filteredReviews = reviews.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (deptFilter !== 'ALL' && r.department !== deptFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.entity_code.toLowerCase().includes(q) ||
        r.project_code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter Playlists
  const filteredPlaylists = playlists.filter((p) => {
    if (playlistTypeFilter !== 'ALL' && p.type !== playlistTypeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.project_code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Review Stats
  const totalReviewsCount = reviews.length;
  const inReviewCount = reviews.filter((r) => r.status === 'In Review' || r.status === 'Submitted').length;
  const approvedReviewsCount = reviews.filter((r) => r.status === 'Approved').length;
  const totalOpenDirectives = reviews.reduce(
    (acc, r) => acc + (r.comments?.filter((c) => !c.is_resolved).length || 0),
    0
  );

  return (
    <div id="reviews-main-page" className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Reviews & Screening Playlists
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  {totalReviewsCount} Review Sessions
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {inReviewCount} In Screening
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Frame-accurate screening rooms, markup annotations, version comparisons, and client review workflows
              </p>
            </div>
          </div>

          {/* View Mode Switcher + Action Button */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setMainView('reviews')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  mainView === 'reviews'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Review Sessions ({reviews.length})</span>
              </button>
              <button
                onClick={() => setMainView('playlists')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  mainView === 'playlists'
                    ? 'bg-indigo-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Playlists & Reels ({playlists.length})</span>
              </button>
            </div>

            {mainView === 'reviews' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateReviewOpen(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                New Review
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreatePlaylistOpen(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap"
                leftIcon={<ListPlus className="w-3.5 h-3.5" />}
              >
                New Screening Reel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Total Review Sessions</div>
          <div className="text-xl font-bold text-white font-mono">{totalReviewsCount} Sessions</div>
          <div className="text-[10px] text-slate-500 font-mono">Across active projects</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-amber-400 uppercase">In Screening / Review</div>
          <div className="text-xl font-bold text-amber-300 font-mono">{inReviewCount} Active</div>
          <div className="text-[10px] text-slate-500 font-mono">Awaiting lead sign-offs</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-emerald-400 uppercase">Approved Versions</div>
          <div className="text-xl font-bold text-emerald-400 font-mono">{approvedReviewsCount} Approved</div>
          <div className="text-[10px] text-slate-500 font-mono">Ready for client delivery</div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] font-mono text-cyan-400 uppercase">Open Directives</div>
          <div className="text-xl font-bold text-cyan-300 font-mono">{totalOpenDirectives} Comments</div>
          <div className="text-[10px] text-slate-500 font-mono">Unresolved feedback items</div>
        </div>
      </div>

      {/* Main Content Area */}
      {mainView === 'reviews' ? (
        /* ================= REVIEW SESSIONS LIST ================= */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reviews by shot, asset, title, or code..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="In Review">In Review</option>
                <option value="Approved">Approved</option>
                <option value="Changes Requested">Changes Requested</option>
                <option value="Rejected">Rejected</option>
                <option value="Closed">Closed</option>
              </select>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Departments</option>
                <option value="Compositing">Compositing</option>
                <option value="Lighting & LookDev">Lighting & LookDev</option>
                <option value="FX & Simulation">FX & Simulation</option>
                <option value="Character Animation">Animation</option>
              </select>
            </div>
          </div>

          {/* Reviews List */}
          {isReviewsLoading ? (
            <LoadingSpinner size="lg" label="Loading screening room sessions..." />
          ) : filteredReviews.length === 0 ? (
            <EmptyState
              icon={<Film className="w-8 h-8 text-indigo-400" />}
              title="No Review Sessions Found"
              description="No review cuts match your current filters. Create a new review session to begin."
              actionLabel="Create Review Session"
              onAction={() => setIsCreateReviewOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReviews.map((rev) => {
                const openComments = rev.comments?.filter((c) => !c.is_resolved).length || 0;

                return (
                  <Card
                    key={rev.id}
                    className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col justify-between overflow-hidden shadow-lg"
                    onClick={() => setActiveReviewId(rev.id)}
                  >
                    <div>
                      {/* Thumbnail & Badges */}
                      <div className="relative aspect-video bg-black overflow-hidden border-b border-slate-800">
                        <img
                          src={rev.thumbnail_url}
                          alt={rev.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                        />
                        <div className="absolute top-2 left-2 flex items-center space-x-1.5">
                          <span className="px-2 py-0.5 rounded bg-black/80 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30 backdrop-blur-sm">
                            {rev.project_code}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] font-bold border border-slate-700 backdrop-blur-sm">
                            {rev.entity_code}
                          </span>
                        </div>

                        <div className="absolute top-2 right-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/90 text-white font-mono text-[10px] font-bold shadow-md">
                            {rev.version_number}
                          </span>
                        </div>

                        <div className="absolute bottom-2 left-2">
                          <StatusBadge status={rev.status} />
                        </div>

                        {/* Hover Overlay Play Icon */}
                        <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="p-3 rounded-full bg-indigo-600 text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-5 h-5 ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 space-y-2">
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                            {rev.title}
                          </h3>
                          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{rev.department}</span>
                            <span>•</span>
                            <span>{rev.total_frames} Frames</span>
                            <span>•</span>
                            <span>{rev.fps} FPS</span>
                          </div>
                        </div>

                        {rev.description && (
                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                            {rev.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Stakeholders & Comment Badges */}
                    <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center space-x-2">
                        {rev.client && (
                          <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-semibold truncate max-w-[140px]">
                            <Building className="w-3 h-3 shrink-0" />
                            {rev.client.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          {rev.versions?.length || 1}
                        </span>
                        <span
                          className={`flex items-center gap-1 ${
                            openComments > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {rev.comments?.length || 0}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= PLAYLISTS LIST ================= */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search playlists, reels, or project codes..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono">
              <select
                value={playlistTypeFilter}
                onChange={(e) => setPlaylistTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Reel Types</option>
                <option value="Dailies">Dailies</option>
                <option value="Sequence Review">Sequence Review</option>
                <option value="Client Turnover">Client Turnover</option>
                <option value="Executive Screening">Executive Screening</option>
              </select>
            </div>
          </div>

          {/* Playlists Grid */}
          {isPlaylistsLoading ? (
            <LoadingSpinner size="lg" label="Loading screening reels..." />
          ) : filteredPlaylists.length === 0 ? (
            <EmptyState
              icon={<List className="w-8 h-8 text-indigo-400" />}
              title="No Screening Reels Found"
              description="Assemble published shot turnover versions into a sequence reel."
              actionLabel="Create Screening Reel"
              onAction={() => setIsCreatePlaylistOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlaylists.map((pl) => (
                <Card
                  key={pl.id}
                  className="bg-slate-900 border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col justify-between overflow-hidden shadow-lg"
                  onClick={() => setActivePlaylistId(pl.id)}
                >
                  <div>
                    {/* Thumbnail Strip */}
                    <div className="relative aspect-video bg-black overflow-hidden border-b border-slate-800">
                      {pl.entries && pl.entries.length > 0 ? (
                        <div className="grid grid-cols-3 h-full">
                          {pl.entries.slice(0, 3).map((en, idx) => (
                            <img
                              key={en.id || idx}
                              src={en.thumbnail_url}
                              alt={en.entity_code}
                              className="w-full h-full object-cover border-r border-slate-900 last:border-0"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-950 font-mono text-xs text-slate-500">
                          Empty Reel
                        </div>
                      )}

                      <div className="absolute top-2 left-2 flex items-center space-x-1.5">
                        <span className="px-2 py-0.5 rounded bg-black/80 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30 backdrop-blur-sm">
                          {pl.project_code}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/80 text-slate-300 font-mono text-[10px] font-bold border border-slate-700 backdrop-blur-sm">
                          {pl.type}
                        </span>
                      </div>

                      <div className="absolute bottom-2 left-2">
                        <StatusBadge status={pl.status} />
                      </div>

                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-emerald-400 font-mono text-[10px] font-bold border border-slate-800">
                        {pl.total_duration_timecode || '00:01:24:00'}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {pl.name}
                        </h3>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{pl.entries?.length || 0} Shots/Cuts</span>
                          <span>•</span>
                          <span>{pl.total_duration_frames || 0} Frames</span>
                        </div>
                      </div>

                      {pl.description && (
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {pl.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-semibold truncate max-w-[160px]">
                      <Building className="w-3 h-3 shrink-0" />
                      {pl.client?.name || 'Authorized Client'}
                    </span>

                    <span className="text-[10px] text-slate-500">
                      By {pl.author_name || 'Alex Chen'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateReviewModal
        isOpen={isCreateReviewOpen}
        onClose={() => setIsCreateReviewOpen(false)}
        onSubmit={async (data) => {
          const newRev = await createReview(data);
          if (newRev?.id) {
            setActiveReviewId(newRev.id);
          }
        }}
        isLoading={isCreatingReview}
      />

      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onSubmit={async (data) => {
          const newPl = await createPlaylist(data);
          if (newPl?.id) {
            setActivePlaylistId(newPl.id);
          }
        }}
        isLoading={isCreatingPlaylist}
      />
      </div>
    </div>
  );
};
