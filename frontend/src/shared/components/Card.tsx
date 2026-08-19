import React, { HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'highlight';
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  hoverable = false,
  id,
  ...props
}) => {
  const base =
    'rounded-xl border transition-all duration-200 overflow-hidden';

  const variants = {
    default:
      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm',
    subtle:
      'bg-slate-50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800/80',
    highlight:
      'bg-gradient-to-b from-slate-900 to-slate-950 border-indigo-500/30 text-white shadow-md',
  };

  const hover = hoverable
    ? 'hover:border-slate-400 dark:hover:border-slate-700 hover:shadow-md cursor-pointer'
    : '';

  return (
    <div
      id={id || `card-${Math.random().toString(36).substring(2, 9)}`}
      className={cn(base, variants[variant], hover, className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn('px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between', className)} {...props}>
    {children}
  </div>
);

export const CardBody: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn('p-5', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  children,
  className,
  ...props
}) => (
  <div className={cn('px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between', className)} {...props}>
    {children}
  </div>
);
