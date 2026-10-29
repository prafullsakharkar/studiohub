import type React from 'react';
import { AlertCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { ServerFormError } from '@/shared/forms/serverErrors';
import { cn } from '@/shared/utils/cn';

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

export const inputClass = (invalid = false) =>
  cn(
    'w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500',
    invalid ? 'border-rose-500' : 'border-slate-800'
  );

/** A labelled form field with its inline error. */
export const Field: React.FC<{ id: string; label: string; error?: string; hint?: string; children: React.ReactNode }> = ({ id, label, error, hint, children }) => (
  <div className="space-y-1">
    <label htmlFor={id} className="block text-xs font-mono text-slate-400">
      {label}
    </label>
    {children}
    {hint && !error && <p className="text-[11px] text-slate-500">{hint}</p>}
    {error && (
      <p role="alert" className="text-[11px] text-rose-400">
        {error}
      </p>
    )}
  </div>
);

/** Banner for what a submit failed with that is not attached to a field (4xx messages, 5xx with request id). */
export const FormBanner: React.FC<{ error: ServerFormError | null }> = ({ error }) => {
  if (!error || (!error.banner && error.details.length === 0)) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-800/70 bg-rose-950/60 p-3 text-xs text-rose-200">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
      <div className="space-y-1">
        {error.banner && <p>{error.banner}</p>}
        {error.details.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {error.requestId && error.status >= 500 && <p className="font-mono text-[10px] text-rose-300/70">Ref: {error.requestId}</p>}
      </div>
    </div>
  );
};

export const Table: React.FC<{ columns: ReadonlyArray<string>; children: React.ReactNode; label: string }> = ({ columns, children, label }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-800">
    <table aria-label={label} className="w-full text-xs">
      <thead className="bg-slate-900 text-slate-400 text-left">
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="px-4 py-2 font-semibold">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">{children}</tbody>
    </table>
  </div>
);

export const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
