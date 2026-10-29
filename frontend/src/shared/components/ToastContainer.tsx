import type React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldAlert,
  Ban,
  X,
  ExternalLink,
} from 'lucide-react';
import { useNotificationStore, type ToastItem, type NotificationType } from '@/shared/stores/useNotificationStore';
import { cn } from '@/shared/utils/cn';

export interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  className?: string;
  maxToasts?: number;
}

const typeConfigs: Record<
  NotificationType,
  {
    icon: React.ElementType;
    iconColor: string;
    bg: string;
    border: string;
    titleColor: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    titleColor: 'text-emerald-950 dark:text-emerald-200',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-700/60',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-rose-500 dark:text-rose-400',
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-rose-200 dark:border-rose-800/60',
    titleColor: 'text-rose-950 dark:text-rose-200',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-700/60',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-500 dark:text-amber-400',
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-amber-200 dark:border-amber-800/60',
    titleColor: 'text-amber-950 dark:text-amber-200',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-700/60',
  },
  info: {
    icon: Info,
    iconColor: 'text-cyan-500 dark:text-cyan-400',
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-cyan-200 dark:border-cyan-800/60',
    titleColor: 'text-cyan-950 dark:text-cyan-200',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/60',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-200 dark:border-cyan-700/60',
  },
  auth: {
    icon: ShieldAlert,
    iconColor: 'text-purple-500 dark:text-purple-400',
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-purple-200 dark:border-purple-800/60',
    titleColor: 'text-purple-950 dark:text-purple-200',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-700/60',
  },
  forbidden: {
    icon: Ban,
    iconColor: 'text-orange-500 dark:text-orange-400',
    bg: 'bg-white dark:bg-slate-900',
    border: 'border-orange-200 dark:border-orange-800/60',
    titleColor: 'text-orange-950 dark:text-orange-200',
    badgeBg: 'bg-orange-50 dark:bg-orange-950/60',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-200 dark:border-orange-700/60',
  },
};

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(toast.duration ?? 5000);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = typeConfigs[toast.type] || typeConfigs.info;
  const Icon = config.icon;

  const handleDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    if (remainingTimeRef.current <= 0) return;

    if (!isPaused) {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, remainingTimeRef.current);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPaused, handleDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      role={toast.type === 'error' || toast.type === 'auth' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' || toast.type === 'auth' ? 'assertive' : 'polite'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border shadow-lg',
        'backdrop-blur-sm transition-all',
        config.bg,
        config.border,
        'min-w-[320px] max-w-[420px]'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={cn('w-5 h-5', config.iconColor)} aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={cn('text-sm font-semibold truncate', config.titleColor)}>
            {toast.title}
          </h4>
          {toast.category && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium border uppercase tracking-wider',
                config.badgeBg,
                config.badgeText,
                config.badgeBorder
              )}
            >
              {toast.category}
            </span>
          )}
        </div>

        {toast.message && (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
            {toast.message}
          </p>
        )}

        {(toast.action || toast.link) && (
          <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  handleDismiss();
                }}
                className={cn(
                  'text-xs font-semibold px-2.5 py-1 rounded-md transition-colors',
                  'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700',
                  'text-slate-900 dark:text-slate-100'
                )}
              >
                {toast.action.label}
              </button>
            )}

            {toast.link && (
              <a
                href={toast.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Learn more</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Close notification"
        className={cn(
          'flex-shrink-0 p-1 -mr-1 -mt-1 rounded-lg transition-colors',
          'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
          'hover:bg-slate-100 dark:hover:bg-slate-800'
        )}
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = 'bottom-right',
  className,
  maxToasts = 5,
}) => {
  const toasts = useNotificationStore((state) => state.toasts);
  const dismissToast = useNotificationStore((state) => state.dismissToast);

  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4 items-end',
    'top-left': 'top-4 left-4 items-start',
    'bottom-right': 'bottom-4 right-4 items-end',
    'bottom-left': 'bottom-4 left-4 items-start',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  };

  const displayedToasts = toasts.slice(-maxToasts);

  if (displayedToasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Notifications"
      className={cn(
        'fixed z-50 flex flex-col gap-2 pointer-events-none p-4 max-h-screen overflow-hidden',
        positionClasses[position] || positionClasses['bottom-right'],
        className
      )}
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {displayedToasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ToastContainer;
