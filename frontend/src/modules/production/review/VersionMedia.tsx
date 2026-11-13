import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { mediaApi, versionPlayback } from '@/api/production/review';
import type { Media, Version } from '@/api/production/review';
import { fetchAllRows } from '@/shared/data/listing';
import { MediaPlayer } from '@/shared/components/media/MediaPlayer';
import { toFps } from '@/shared/components/media/frameTime';
import { SmartImg } from '@/components/ui/SmartImg';
import { safeWebUrl } from '@/shared/utils/safeUrl';
import { cn } from '@/shared/utils/cn';
import { mediaName } from './mediaCard';
import { ReviewMoviePanel } from './ReviewMoviePanel';

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-xs text-slate-200">{children || '—'}</dd>
  </div>
);

/**
 * The version's own preview in the player, and the media linked to its shot or asset (plates, references, turntables)
 * to put in the same player. A media item has no frame rate or first frame of its own, so it plays at the version's rate from frame 1.
 */
export const VersionMediaTab: React.FC<{ version: Version }> = ({ version }) => {
  const [chosen, setChosen] = useState<string | null>(null);
  const linked = useQuery({
    queryKey: [...mediaApi.keys.all, 'of', version.entity_type, version.entity_id],
    queryFn: ({ signal }) => fetchAllRows(mediaApi.list, { project_id: version.project_id }, { signal }),
    enabled: Boolean(version.entity_id),
    select: (rows) => rows.filter((m) => m.entity_id === version.entity_id && m.entity_type === version.entity_type),
  });
  const items: Media[] = linked.data ?? [];
  const item = items.find((m) => m.id === chosen);
  const playback = versionPlayback(version);
  const fps = toFps(playback.fps);
  const own = !item;
  const src = own ? playback.src : item.preview_url || item.source_url;
  const poster = own ? playback.poster : item.thumbnail_url;
  const label = own ? `${version.code} preview` : mediaName(item);
  const probe = version.review_media?.probe;

  return (
    <div className="space-y-4">
      <ReviewMoviePanel version={version} />
      <MediaPlayer key={chosen ?? 'own'} label={label} src={src} poster={poster} sourceId={own ? playback.sourceId : undefined} fps={fps} startFrame={own ? (version.start_frame ?? 1) : 1} />
      <dl aria-label="Preview details" className="grid gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Resolution">{own ? version.resolution || (probe ? `${probe.width}×${probe.height}` : '') : item.resolution}</Fact>
        <Fact label="Frame rate">{String(fps)}</Fact>
        <Fact label="Frames">{own ? version.frame_range : ''}</Fact>
        <Fact label="Colour space">{own ? version.color_space : ''}</Fact>
        <Fact label="Size">{Number(own ? version.file_size_mb : item.file_size_mb) > 0 ? `${own ? version.file_size_mb : item.file_size_mb} MB` : ''}</Fact>
        <Fact label="Source">{own ? (playback.generated ? 'Review copy made by the server' : 'This version') : mediaName(item)}</Fact>
      </dl>

      <section aria-label={`Media on ${version.entity_code || 'this record'}`} className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Media on {version.entity_code || 'this record'}</h2>
        {linked.isLoading ? (
          <p className="text-xs text-slate-500">Loading media…</p>
        ) : items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No other media is linked to this {version.entity_type.toLowerCase() || 'record'}.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <li>
              <button type="button" aria-pressed={own} onClick={() => setChosen(null)} className={cn('w-full rounded-lg border bg-slate-900/60 p-2 text-left text-xs', own ? 'border-cyan-500/60' : 'border-slate-800 hover:border-slate-700')}>
                <span className="block font-semibold text-slate-100">This version</span>
                <span className="block truncate font-mono text-[11px] text-slate-400">{version.version_number}</span>
              </button>
            </li>
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" aria-pressed={chosen === m.id} onClick={() => setChosen(m.id)} className={cn('w-full overflow-hidden rounded-lg border bg-slate-900/60 text-left text-xs', chosen === m.id ? 'border-cyan-500/60' : 'border-slate-800 hover:border-slate-700')}>
                  <SmartImg src={safeWebUrl(m.thumbnail_url)} alt="" className="aspect-video w-full object-cover" />
                  <span className="block truncate px-2 pt-1.5 font-semibold text-slate-100">{mediaName(m)}</span>
                  <span className="block truncate px-2 pb-1.5 font-mono text-[11px] text-slate-400">{[m.media_type, m.category].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
