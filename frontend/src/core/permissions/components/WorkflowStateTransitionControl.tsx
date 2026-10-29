import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ArrowRight, Lock, Check } from 'lucide-react';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { PermissionEvaluationContext } from '@/types/identity';
import { getAllowedWorkflowTransitions, WORKFLOW_DEFINITIONS } from '../workflowStateEngine';

export interface WorkflowStateTransitionControlProps {
  id?: string;
  entityType: string;
  currentState: string;
  entity?: any;
  onTransition: (targetState: string) => void | Promise<void>;
  disabled?: boolean;
  context?: PermissionEvaluationContext;
  className?: string;
}

export const WorkflowStateTransitionControl: React.FC<WorkflowStateTransitionControlProps> = ({
  id,
  entityType,
  currentState,
  entity,
  onTransition,
  disabled = false,
  context,
  className = '',
}) => {
  const { user } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const evalContext: PermissionEvaluationContext = {
    ...context,
  };

  const allowedTransitions = getAllowedWorkflowTransitions(
    user,
    entityType,
    currentState,
    entity,
    evalContext
  );

  const entityDef = WORKFLOW_DEFINITIONS[entityType.toLowerCase()];
  const currentStateMeta = entityDef?.states.find(
    (s) => s.code === currentState.toUpperCase().trim()
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectTransition = async (targetState: string) => {
    setIsOpen(false);
    setIsUpdating(true);
    try {
      await onTransition(targetState);
    } finally {
      setIsUpdating(false);
    }
  };

  const stateColor = currentStateMeta?.color || 'bg-zinc-800 text-zinc-300 border-zinc-700';
  const stateLabel = currentStateMeta?.label || currentState;
  const canChangeState = allowedTransitions.length > 0 && !disabled && !isUpdating;

  return (
    <div
      ref={menuRef}
      id={id || `workflow-control-${entityType}-${currentState}`}
      className={`relative inline-block text-left ${className}`}
    >
      <button
        type="button"
        id={`btn-state-trigger-${entityType}`}
        disabled={!canChangeState}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${stateColor} ${
          canChangeState
            ? 'hover:brightness-110 cursor-pointer shadow-sm'
            : 'cursor-default opacity-90'
        }`}
        title={
          canChangeState
            ? `Current status: ${stateLabel}. Click to transition.`
            : `Current status: ${stateLabel}. No further transitions permitted for your role.`
        }
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        <span>{stateLabel}</span>
        {canChangeState ? (
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        ) : (
          <Lock className="w-3 h-3 opacity-40 ml-0.5" />
        )}
      </button>

      {isOpen && canChangeState && (
        <div
          id={`menu-transitions-${entityType}`}
          className="absolute z-50 mt-1.5 w-52 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl p-1.5 backdrop-blur-md"
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80 mb-1">
            Allowed Transitions
          </div>
          <div className="flex flex-col gap-0.5">
            {allowedTransitions.map((trans) => (
              <button
                key={trans.targetState}
                type="button"
                id={`btn-transition-to-${trans.targetState}`}
                onClick={() => handleSelectTransition(trans.targetState)}
                className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-left rounded-md hover:bg-zinc-800/80 text-zinc-200 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                  <span className="font-medium">{trans.label}</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${trans.color}`}
                >
                  {trans.targetState}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
