import { Image as ImageIcon } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SmartImg } from '@/components/ui/SmartImg';
import type { CardContext } from './types';

/** A small label over the picture or the band: a code, a version, a frame range. */
export const CardChip: React.FC<{ children: React.ReactNode; tone?: 'plain' | 'accent' | 'good' | 'warn'; title?: string }> = ({ children, tone = 'plain', title }) => {
  const color = { plain: 'text-slate-200', accent: 'text-indigo-300', good: 'text-emerald-300', warn: 'text-amber-300' }[tone];
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1 truncate rounded border border-slate-700 bg-black/80 px-2 py-0.5 font-mono text-[11px] font-bold ${color}`}>
      {children}
    </span>
  );
};

interface ListCardProps {
  ctx: CardContext;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /**
   * A picture; without it the top is an information band (a delivery or an export job has no picture). `strip` is a
   * filmstrip (one image of `tiles` frames side by side): moving the pointer across the picture scrubs it.
   */
  image?: { src?: string | null; alt: string; strip?: { src: string; tiles: number } };
  band?: React.ReactNode;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  bottomLeft?: React.ReactNode;
  bottomRight?: React.ReactNode;
  /** The body under the title: facts, a banner. */
  children?: React.ReactNode;
  /** Left of the action footer: counts, who. */
  footerLeft?: React.ReactNode;
}

/** The filmstrip frame under the pointer, laid over the picture while the pointer is on it. */
const FilmstripScrub: React.FC<{ src: string; tiles: number }> = ({ src, tiles }) => {
  const [at, setAt] = useState<number | null>(null);
  const count = Math.max(1, Math.floor(tiles));
  return (
    <div
      data-testid="filmstrip-scrub"
      className="absolute inset-0"
      onPointerMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const share = box.width > 0 ? (e.clientX - box.left) / box.width : 0;
        setAt(Math.min(count - 1, Math.max(0, Math.floor(share * count))));
      }}
      onPointerLeave={() => setAt(null)}
    >
      {at !== null && (
        <div
          aria-hidden
          className="h-full w-full bg-no-repeat"
          style={{ backgroundImage: `url("${src}")`, backgroundSize: `${count * 100}% 100%`, backgroundPosition: count > 1 ? `${(at / (count - 1)) * 100}% 0` : '0 0' }}
        />
      )}
    </div>
  );
};

/**
 * The card the list screens share (the former Version, Review, Media, Delivery and Publish cards): a picture or
 * band with badges laid over it, a title and facts, and a footer with the same Edit / Delete / actions as the
 * table row.
 */
export const ListCard: React.FC<ListCardProps> = ({ ctx, title, subtitle, image, band, topLeft, topRight, bottomLeft, bottomRight, children, footerLeft }) => {
  const top = (
    <div className="relative aspect-video w-full overflow-hidden border-b border-slate-800/80 bg-slate-950">
      {image ? (
        <>
          <SmartImg src={image.src} alt={image.alt} className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-105 group-hover:opacity-100" />
          {image.strip && <FilmstripScrub src={image.strip.src} tiles={image.strip.tiles} />}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-700">{band ?? <ImageIcon className="h-10 w-10" aria-hidden />}</div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/40" />
      <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">{topLeft}</div>
        <div className="shrink-0">{topRight}</div>
      </div>
      {(bottomLeft || bottomRight) && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0">{bottomLeft}</div>
          <div className="shrink-0">{bottomRight}</div>
        </div>
      )}
    </div>
  );
  return (
    <article className="group flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 shadow-sm transition-colors hover:border-slate-700">
      <div>
        {ctx.href ? (
          <Link to={ctx.href} tabIndex={-1} aria-hidden="true" className="block">
            {top}
          </Link>
        ) : (
          top
        )}
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            {ctx.select}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-white">{ctx.href ? <Link to={ctx.href} className="hover:text-indigo-300">{title}</Link> : title}</h3>
              {subtitle && <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {children}
        </div>
      </div>
      {(ctx.controls || footerLeft) && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/90 p-3 text-xs">
          <div className="flex min-w-0 items-center gap-3 text-slate-400">{footerLeft}</div>
          <div className="flex flex-wrap items-center justify-end gap-3">{ctx.controls}</div>
        </div>
      )}
    </article>
  );
};

/** A label and a value on one line, for the facts box of a card. */
export const CardFact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-slate-400">{label}</span>
    <span className="min-w-0 truncate text-right text-slate-200">{children}</span>
  </div>
);

export const CardFacts: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-950/80 p-2.5 text-xs">{children}</div>;
