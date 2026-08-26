import React, { useState } from 'react';
import {
  Film,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Play,
  Calendar,
  User,
  Plus,
  Clock,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Asset } from '@/mocks/db/assets/assets';
import { useReviews } from '@/modules/reviews/hooks/useReviews';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';

interface AssetReviewsTabProps {
  asset: Asset;
}

export const AssetReviewsTab: React.FC<AssetReviewsTabProps> = ({ asset }) => {
  const [activePlaybackReview, setActivePlaybackReview] = useState<any | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const reviews = [
    {
      id: `rev-01-${asset.id}`,
      title: `${asset.name} - Final LookDev & Shading Dailies`,
      version: asset.version || 'v009',
      session_type: 'Director Sign-off Screening',
      date: '2026-08-20',
      timecode: '01:00:14:08',
      reviewer_name: 'Alex Chen',
      reviewer_role: 'VFX Supervisor',
      reviewer_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      status: 'Approved',
      annotations_count: 8,
      video_url: asset.turntable_video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail_url: asset.thumbnail_url,
      summary: 'Clearcoat reflections and carbon-fiber anisotropic grain looks exceptional under the overcast HDRI test rig.',
    },
    {
      id: `rev-02-${asset.id}`,
      title: `${asset.name} - Retopology & Silhouette Review`,
      version: 'v004',
      session_type: 'Department Lead Review',
      date: '2026-08-10',
      timecode: '00:45:00:12',
      reviewer_name: 'Sarah Jenkins',
      reviewer_role: 'Lead Modeler',
      reviewer_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      status: 'Approved',
      annotations_count: 14,
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=600&auto=format&fit=crop&q=80',
      summary: 'Addressed edge flow around the cockpit canopy and door bevels. Ready for lookdev texturing.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-amber-400" />
            Screening Room & Dailies Reviews
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Supervisor turnaround review sessions, frame annotations, and approval sign-offs
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsScheduleOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Schedule Review Session
        </Button>
      </div>

      {/* Reviews Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reviews.map((rev) => (
          <div
            key={rev.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden shadow-lg transition-all flex flex-col justify-between"
          >
            <div>
              {/* Media Preview Box */}
              <div className="relative aspect-16/9 bg-slate-950 overflow-hidden group cursor-pointer" onClick={() => setActivePlaybackReview(rev)}>
                <img
                  src={rev.thumbnail_url}
                  alt={rev.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-all flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/90 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-slate-950/80 backdrop-blur-md text-emerald-400 text-[10px] font-mono rounded border border-slate-800 font-bold">
                    {rev.version}
                  </span>
                  <Badge
                    variant={rev.status === 'Approved' ? 'success' : rev.status === 'Retake' ? 'error' : 'warning'}
                    className="text-[10px] font-mono"
                  >
                    {rev.status}
                  </Badge>
                </div>

                <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                  TC {rev.timecode}
                </div>
              </div>

              {/* Review Details */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">
                      {rev.session_type}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">{rev.title}</h4>
                  </div>
                </div>

                <p className="text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80 font-sans">
                  "{rev.summary}"
                </p>
              </div>
            </div>

            {/* Footer / Reviewer info */}
            <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <img
                  src={rev.reviewer_avatar}
                  alt={rev.reviewer_name}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-slate-300 font-sans">{rev.reviewer_name}</span>
                <span className="text-slate-500">({rev.reviewer_role})</span>
              </div>

              <div className="flex items-center space-x-3 text-slate-400">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> {rev.annotations_count} notes
                </span>
                <span>{rev.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Review Playback Modal */}
      {activePlaybackReview && (
        <Modal
          isOpen={!!activePlaybackReview}
          onClose={() => setActivePlaybackReview(null)}
          title={`Screening: ${activePlaybackReview.title}`}
        >
          <div className="space-y-4">
            <div className="relative aspect-16/9 bg-black rounded-lg overflow-hidden border border-slate-800">
              <video
                src={activePlaybackReview.video_url}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Verdict</span>
                <Badge variant="success" className="text-xs font-mono">
                  {activePlaybackReview.status}
                </Badge>
              </div>
              <div className="text-slate-300 font-sans">
                <span className="font-bold text-white block mb-1">Supervisor Notes:</span>
                {activePlaybackReview.summary}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Schedule Session Modal */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title={`Schedule Screening for ${asset.code}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsScheduleOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Session Title</label>
            <input
              type="text"
              defaultValue={`${asset.name} - Turntable Review`}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Review Type</label>
              <select className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                <option>LookDev Dailies</option>
                <option>Model Topology Sign-off</option>
                <option>Rig & Deformation Check</option>
                <option>Director Final Screening</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Version</label>
              <input
                type="text"
                defaultValue={asset.version}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsScheduleOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Schedule Session
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
