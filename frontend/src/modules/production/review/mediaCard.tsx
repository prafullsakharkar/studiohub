import { CardChip, CardFacts, CardFact, ListCard } from '@/modules/directory/ListCard';
import type { CardContext } from '@/modules/directory/types';
import type { Media } from '@/api/production/review';
import { safeWebUrl } from '@/shared/utils/safeUrl';

/** What a media item is called: its title, else its file name, else its code. */
export const mediaName = (row: Pick<Media, 'id' | 'title' | 'file_name' | 'code' | 'media_type'>) => row.title || row.file_name || row.code || `${row.media_type} ${row.id.slice(0, 8)}`;

/** A media item as the former media grid drew it: its thumbnail with type and format over it, then the file facts. */
export function mediaCard(row: Media, ctx: CardContext) {
  const size = Number(row.file_size_mb) > 0 ? `${row.file_size_mb} MB` : '';
  return (
    <ListCard
      ctx={ctx}
      image={{ src: safeWebUrl(row.thumbnail_url), alt: `${mediaName(row)} thumbnail` }}
      topLeft={<CardChip tone="accent">{row.media_type || 'media'}</CardChip>}
      topRight={row.file_format ? <CardChip>{row.file_format}</CardChip> : undefined}
      bottomLeft={row.resolution ? <CardChip>{row.resolution}</CardChip> : undefined}
      bottomRight={size ? <CardChip>{size}</CardChip> : undefined}
      title={mediaName(row)}
      subtitle={row.code && row.code !== mediaName(row) ? row.code : undefined}
    >
      <CardFacts>
        <CardFact label="On">{row.entity_type || '—'}</CardFact>
        <CardFact label="Category">{row.category || '—'}</CardFact>
        <CardFact label="Storage">{row.storage_tier || '—'}</CardFact>
      </CardFacts>
    </ListCard>
  );
}
