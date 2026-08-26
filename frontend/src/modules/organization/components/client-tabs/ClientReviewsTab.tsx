import React, { useState } from 'react';
import { Eye, Play, CheckCircle2, AlertCircle, Clock, Plus, ExternalLink, MessageSquare, Film } from 'lucide-react';
import { Client, ClientReviewSession } from '@/types/organization';
import { mockClientReviewSessions } from '@/mocks/db/organization/clientVendorDetails';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface ClientReviewsTabProps {
  client: Client;
}

export const ClientReviewsTab: React.FC<ClientReviewsTabProps> = ({ client }) => {
  const [reviews, setReviews] = useState<ClientReviewSession[]>(() =>
    mockClientReviewSessions.filter((r) => r.client_id === client.id)
  );

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-400" />
            Client Review Sessions & Dailies Playlists ({reviews.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized review rooms, live annotations, executive approval sign-offs, and note distributions.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => alert('Launching new Client Review Room & Sync Session...')}
          className="flex items-center gap-1.5 text-xs"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Launch Sync Review
        </Button>
      </div>

      {/* Review Sessions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reviews.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
            No client review sessions scheduled.
          </div>
        ) : (
          reviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{rev.title}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] text-slate-300">
                        {rev.project_code}
                      </Badge>
                      <span>Playlist: {rev.playlist_name}</span>
                    </div>
                  </div>

                  <Badge
                    variant={rev.status === 'Completed' ? 'success' : 'warning'}
                    className="text-[10px]"
                  >
                    {rev.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 my-4 text-center">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400">Total Versions</div>
                    <div className="text-base font-bold font-mono text-white mt-0.5">
                      {rev.versions_count}
                    </div>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400">Approved</div>
                    <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                      {rev.approved_count}
                    </div>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-[10px] font-mono text-slate-400">Revisions</div>
                    <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
                      {rev.revisions_count}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                  <div>
                    <span className="text-slate-500">Lead Reviewer:</span>{' '}
                    <span className="text-slate-200">{rev.lead_reviewer}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Session Timestamp:</span>{' '}
                    <span className="text-indigo-300">{new Date(rev.date).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {rev.notes_count} Direct Review Notes
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => alert(`Opening playlist: ${rev.playlist_name}`)}
                >
                  Open Review Room →
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
