import type React from 'react';
import { AlertCircle } from 'lucide-react';
import type { ServerFormError } from '@/shared/forms/serverErrors';
import { cn } from '@/shared/utils/cn';

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
