import type React from 'react';
import { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={`w-full bg-slate-900 border ${
              error ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'
            } text-slate-200 text-xs rounded-xl px-3 py-2.5 transition-colors placeholder:text-slate-500 focus:outline-hidden focus:ring-1 ${
              error ? 'focus:ring-rose-500' : 'focus:ring-indigo-500'
            } disabled:opacity-50 disabled:cursor-not-allowed ${leftIcon ? 'pl-9' : ''} ${
              rightIcon ? 'pr-9' : ''
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
