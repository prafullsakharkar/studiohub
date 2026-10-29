import type React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface LoadingSpinnerProps {
  id?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
  message?: string;
  className?: string;
  fullScreen?: boolean;
  color?: string;
}

const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  id,
  size = 'md',
  label,
  message,
  className,
  fullScreen = false,
  color = 'text-indigo-500',
}) => {
  const displayText = message || label;
  const spinner = (
    <div
      id={id}
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 p-4 select-none', className)}
    >
      <Loader2
        className={cn('animate-spin', sizeMap[size] || sizeMap.md, color)}
        aria-hidden="true"
      />
      {displayText && (
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wide text-center">
          {displayText}
        </p>
      )}
      <span className="sr-only">{displayText || 'Loading...'}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
