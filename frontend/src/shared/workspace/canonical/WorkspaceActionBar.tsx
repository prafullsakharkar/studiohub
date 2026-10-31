import type React from 'react';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { WorkspaceAction } from './types';
import { WorkspaceOverflowMenu } from './WorkspaceOverflowMenu';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';

export interface WorkspaceActionBarProps {
  actions: WorkspaceAction[];
  maxVisibleActions?: number;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const WorkspaceActionBar: React.FC<WorkspaceActionBarProps> = ({
  actions = [],
  maxVisibleActions = 3,
  className = '',
  size = 'sm',
}) => {
  const [confirmingAction, setConfirmingAction] = useState<WorkspaceAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const visibleActions = actions.filter((action) => action.visible !== false);

  if (visibleActions.length === 0) {
    return null;
  }

  const prominentActions = visibleActions.slice(0, maxVisibleActions);
  const overflowActions = visibleActions.slice(maxVisibleActions);

  const handleActionClick = (action: WorkspaceAction, e: React.MouseEvent) => {
    if (action.disabled || action.loading) return;
    if (action.confirm) {
      setConfirmingAction(action);
      return;
    }
    action.onClick(e);
  };

  const handleConfirmExecute = async () => {
    if (!confirmingAction) return;
    try {
      setIsExecuting(true);
      await confirmingAction.onClick();
    } finally {
      setIsExecuting(false);
      setConfirmingAction(null);
    }
  };

  const buttonSizeClasses = {
    xs: 'px-2.5 py-1 text-xs gap-1.5',
    sm: 'px-3 py-1.5 text-xs gap-2',
    md: 'px-4 py-2 text-sm gap-2',
  }[size];

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        {prominentActions.map((action) => {
          const isPrimary = action.variant === 'primary';
          const isDanger = action.variant === 'danger' || action.danger;
          const isGhost = action.variant === 'ghost';
          const isSuccess = action.variant === 'success';

          let variantClasses =
            'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700';

          if (isPrimary) {
            variantClasses =
              'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/25 border border-indigo-500/40';
          } else if (isDanger) {
            variantClasses =
              'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 hover:border-rose-700';
          } else if (isSuccess) {
            variantClasses =
              'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 hover:border-emerald-700';
          } else if (isGhost) {
            variantClasses =
              'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-slate-100 border border-transparent';
          }

          return (
            <button
              key={action.id}
              type="button"
              disabled={action.disabled || action.loading}
              onClick={(e) => handleActionClick(action, e)}
              title={action.tooltip || action.label}
              className={cn(
                'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]',
                buttonSizeClasses,
                variantClasses,
                action.className
              )}
            >
              {action.loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
              ) : (
                action.icon && <span className="shrink-0">{action.icon}</span>
              )}
              <span>{action.label}</span>
              {action.shortcut && (
                <kbd className="hidden md:inline-block ml-1 font-mono text-[10px] text-slate-400 bg-black/30 px-1 rounded">
                  {action.shortcut}
                </kbd>
              )}
            </button>
          );
        })}

        {overflowActions.length > 0 && (
          <WorkspaceOverflowMenu actions={overflowActions} size={size} onSelect={handleActionClick} />
        )}
      </div>

      {confirmingAction && (
        <Modal
          isOpen={true}
          onClose={() => !isExecuting && setConfirmingAction(null)}
          title={confirmingAction.confirm?.title || 'Confirm Action'}
        >
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              {confirmingAction.confirm?.message}
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                disabled={isExecuting}
                onClick={() => setConfirmingAction(null)}
              >
                {confirmingAction.confirm?.cancelText || 'Cancel'}
              </Button>
              <Button
                variant={
                  confirmingAction.confirm?.variant === 'danger' || confirmingAction.danger
                    ? 'danger'
                    : 'primary'
                }
                size="sm"
                isLoading={isExecuting}
                onClick={handleConfirmExecute}
              >
                {confirmingAction.confirm?.confirmText || 'Confirm'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
