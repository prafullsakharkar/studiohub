import { Film, Star, User } from 'lucide-react';
import { reviewMediaUrl, versionThumbnail } from '@/api/production/review';
import type { Version } from '@/api/production/review';
import { CardChip, CardFacts, ListCard } from '@/modules/directory/ListCard';
import type { CardContext } from '@/modules/directory/types';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { safeWebUrl } from '@/shared/utils/safeUrl';

/** A version as the former Versions grid drew it: the picture with its number and status over it, then who made it. */
export function versionCard(row: Version, ctx: CardContext) {
  // The version's own thumbnail, else the one the server made (RP-5); its filmstrip scrubs on hover.
  const media = row.review_media;
  const strip = reviewMediaUrl(media?.filmstrip_url);
  return (
    <ListCard
      ctx={ctx}
      image={{ src: safeWebUrl(versionThumbnail(row)), alt: `${row.code} thumbnail`, strip: strip && media ? { src: strip, tiles: media.filmstrip_tiles } : undefined }}
      topLeft={
        <>
          <CardChip tone="good">{row.version_number}</CardChip>
          {row.is_hero && (
            <CardChip tone="warn">
              <Star className="h-3 w-3" aria-hidden /> Hero
            </CardChip>
          )}
        </>
      }
      topRight={<StatusBadge status={row.status} />}
      bottomLeft={
        <CardChip tone="accent">
          <Film className="h-3 w-3" aria-hidden /> {row.entity_code || row.entity_type || 'No shot or asset'}
        </CardChip>
      }
      bottomRight={row.frame_range || row.resolution ? <CardChip>{row.frame_range || row.resolution}</CardChip> : undefined}
      title={row.code}
      subtitle={[row.department, row.project_code].filter(Boolean).join(' • ') || undefined}
      footerLeft={
        <>
          <span className="inline-flex items-center gap-1 truncate">
            <User className="h-3.5 w-3.5" aria-hidden /> {row.artist_name || 'No artist'}
          </span>
          {row.is_published && <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">Published</span>}
        </>
      }
    >
      {row.color_space && (
        <CardFacts>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">{row.resolution || '—'}</span>
            <span>{row.color_space}</span>
          </div>
        </CardFacts>
      )}
    </ListCard>
  );
}
