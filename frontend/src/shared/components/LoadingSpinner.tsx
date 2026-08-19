import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Loading production data...',
  className,
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 space-y-3', className)}>
      <Loader2 className={cn('animate-spin text-indigo-500', sizeMap[size])} />
      {label && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">{label}</p>}
    </div>
  );
};
