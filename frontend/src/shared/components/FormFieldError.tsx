import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ApiError } from '@/api/errors/ApiError';

interface FormFieldErrorProps {
  error?: ApiError | Error | null;
  field?: string;
  className?: string;
}

export const FormFieldError: React.FC<FormFieldErrorProps> = ({ error, field, className = '' }) => {
  if (!error) return null;

  if (error instanceof ApiError && field) {
    const fieldErrors = error.getFieldErrors(field);
    if (!fieldErrors || fieldErrors.length === 0) return null;

    return (
      <div className={`mt-1.5 flex flex-col gap-0.5 text-xs text-rose-500 font-medium ${className}`}>
        {fieldErrors.map((msg, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{msg}</span>
          </div>
        ))}
      </div>
    );
  }

  // Non-field error or general error fallback
  if (!field && error) {
    const message = error instanceof ApiError ? error.message : error.message;
    return (
      <div className={`p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-start gap-2 ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">{error instanceof ApiError && error.status ? `Error (${error.status})` : 'Request Error'}</p>
          <p className="mt-0.5 text-rose-400">{message}</p>
        </div>
      </div>
    );
  }

  return null;
};
