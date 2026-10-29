import type React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/utils/cn';

export interface TabContentTransitionProps {
  /** Unique identifier for the active tab (e.g. activeTabId, tabKey) */
  tabKey: string | number;
  children: React.ReactNode;
  className?: string;
  /** Duration of the subtle fade-in transition in seconds. Default is 0.18s (180ms). */
  duration?: number;
}

/**
 * Reusable Workspace Tab Content Transition wrapper.
 * Provides a fast, subtle fade-in transition (150-250ms) when switching workspace tabs,
 * avoiding layout shifts and respecting prefers-reduced-motion preferences.
 */
export const TabContentTransition: React.FC<TabContentTransitionProps> = ({
  tabKey,
  children,
  className = '',
  duration = 0.18,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key={tabKey}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: shouldReduceMotion ? 0 : duration,
        ease: 'easeOut',
      }}
      className={cn('w-full flex-1 min-h-0', className)}
    >
      {children}
    </motion.div>
  );
};
