import { ArrowDown, ArrowUp } from 'lucide-react';
import type React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { formatDateTime } from '@/core/locale/studioLocale';

/** Page chrome shared by the identity screens. */
export const PageShell: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: ReadonlyArray<{ to: string; label: string; end?: boolean }>;
  children: React.ReactNode;
}> = ({ title, subtitle, actions, tabs, children }) => (
  <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 w-full">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {tabs && (
      <nav aria-label={`${title} sections`} className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'px-3 py-2 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap',
                isActive ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    )}
    {children}
  </div>
);

export { Field, FormBanner, inputClass } from '@/shared/forms/FormParts';

/** Which column a table is sorted by; `onSort` gets a header from `columns` and the caller sorts the rows. */
export interface TableSort {
  /** The headers that sort on a click. */
  columns: ReadonlyArray<string>;
  by: string;
  direction: 'asc' | 'desc';
  onSort: (column: string) => void;
}

export const Table: React.FC<{ columns: ReadonlyArray<string>; children: React.ReactNode; label: string; sort?: TableSort }> = ({ columns, children, label, sort }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-800">
    <table aria-label={label} className="w-full text-xs">
      <thead className="bg-slate-900 text-slate-400 text-left">
        <tr>
          {columns.map((c) => {
            const sortable = Boolean(sort?.columns.includes(c));
            const active = sortable && sort?.by === c ? sort.direction : null;
            return (
              <th key={c} scope="col" aria-sort={active ? (active === 'asc' ? 'ascending' : 'descending') : undefined} className="px-4 py-2 font-semibold">
                {sortable ? (
                  <button type="button" className="inline-flex items-center gap-1 hover:text-slate-200" onClick={() => sort?.onSort(c)}>
                    {c}
                    {active && (active === 'asc' ? <ArrowUp className="w-3 h-3" aria-hidden="true" /> : <ArrowDown className="w-3 h-3" aria-hidden="true" />)}
                  </button>
                ) : (
                  c
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">{children}</tbody>
    </table>
  </div>
);

export const formatDate = (iso: string | null | undefined) => formatDateTime(iso);
