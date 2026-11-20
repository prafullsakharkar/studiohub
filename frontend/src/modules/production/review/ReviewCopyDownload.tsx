import { Download } from 'lucide-react';
import { reviewMediaUrl } from '@/api/production/review';
import type { ReviewMedia } from '@/api/production/review';

/**
 * RP-23 (C-RP-56, Q-RP-106, Q-RP-108): the link that saves a version's review copy (the movie, or the JPEG of a still),
 * as made, with its burn-ins and grade. The server gives `download_url` only to a viewer the project's
 * `review_downloads` lets download, and checks it again when the link is followed; each download is recorded (C-RP-57).
 * RP-25 (C-RP-59): a copy made while the project puts a slate first downloads with it; the title says so.
 */
export function downloadHref(media: Pick<ReviewMedia, 'status' | 'download_url'> | null | undefined): string | undefined {
  return media?.status === 'ready' ? reviewMediaUrl(media.download_url) : undefined;
}

/** What the link's title says the saved file holds. */
export function downloadTitle(media: Pick<ReviewMedia, 'probe'> | null | undefined): string {
  return media?.probe?.slate
    ? 'Save the review copy, with a two-second slate first and its burn-ins and grade. Downloads are recorded.'
    : 'Save the review copy, with its burn-ins and grade. Downloads are recorded.';
}

export function ReviewCopyDownload({ media, code }: { media: ReviewMedia | null | undefined; code: string }) {
  const href = downloadHref(media);
  if (!href) return null;
  return (
    <a
      href={href}
      download
      aria-label={`Download the review copy of ${code}`}
      title={downloadTitle(media)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-200"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      Download
    </a>
  );
}
