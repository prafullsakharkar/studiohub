import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ApiError } from '@/api/errors/ApiError';

export interface ValidationSummaryProps {
  error?: unknown;
  fieldErrors?: Record<string, string[]>;
  onDismiss?: () => void;
  className?: string;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  error,
  fieldErrors: customFieldErrors,
  onDismiss,
  className = '',
}) => {
  let errors: Record<string, string[]> = customFieldErrors || {};
  let title = 'Please correct the following errors:';

  if (error instanceof ApiError) {
    errors = { ...errors, ...error.fieldErrors };
    if (error.userMessage) {
      title = error.userMessage;
    }
  }

  const fieldEntries = Object.entries(errors).filter(([_, errs]) => Array.isArray(errs) && errs.length > 0);

  if (fieldEntries.length === 0 && !error) return null;

  return (
    <div
      id="system-validation-summary"
      className={`p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{title}</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-400 hover:text-amber-200 p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {fieldEntries.length > 0 && (
        <ul className="list-disc list-inside space-y-1 pl-1 text-slate-300">
          {fieldEntries.map(([field, errList]) => (
            <li key={field} className="leading-relaxed">
              <span className="font-medium text-amber-300/90 capitalize">{field.replace(/_/g, ' ')}:</span>{' '}
              {errList.join(' ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
