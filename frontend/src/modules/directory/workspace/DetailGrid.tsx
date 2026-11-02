import type React from 'react';

export interface DetailItem {
  label: string;
  value: React.ReactNode;
}

const blank = (value: React.ReactNode) => value === undefined || value === null || value === '';

/** The fields of one record as labelled values; an empty value shows a dash. */
export const DetailGrid: React.FC<{ title: string; items: DetailItem[]; description?: string }> = ({ title, items, description }) => (
  <section aria-label={title} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {description && <p className="text-xs text-slate-400 leading-relaxed">{description}</p>}
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      {items.map((item) => (
        <div key={item.label} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
          <dt className="text-slate-500 text-[10px]">{item.label}</dt>
          <dd className="text-white font-semibold break-words">{blank(item.value) ? '—' : item.value}</dd>
        </div>
      ))}
    </dl>
  </section>
);
