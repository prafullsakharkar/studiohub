import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Edit, Archive, RotateCcw, Trash2, Check, X, Send, UserCheck } from 'lucide-react';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { PermissionEvaluationContext } from '@/types/identity';
import { evaluateResourceAction } from '../resourceAuthorizationEngine';

export interface EntityActionItem {
  id: string;
  action: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
  onExecute: () => void | Promise<void>;
}

export interface EntityActionsMenuProps {
  id?: string;
  resourceType: string;
  entity: any;
  actions?: EntityActionItem[];
  context?: PermissionEvaluationContext;
  className?: string;
}

export const EntityActionsMenu: React.FC<EntityActionsMenuProps> = ({
  id,
  resourceType,
  entity,
  actions = [],
  context,
  className = '',
}) => {
  const { user } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const evalContext: PermissionEvaluationContext = {
    ...context,
  };

  // Filter actions that are authorized for this user & entity
  const authorizedActions = actions.filter((act) => {
    const auth = evaluateResourceAction(
      user,
      resourceType,
      act.action,
      entity,
      evalContext
    );
    return auth.allowed;
  });

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

  if (authorizedActions.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      id={id || `actions-menu-${resourceType}-${entity?.id || 'item'}`}
      className={`relative inline-block text-left ${className}`}
    >
      <button
        type="button"
        id={`btn-actions-trigger-${resourceType}-${entity?.id || 'item'}`}
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
        title="Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          id={`dropdown-actions-${resourceType}-${entity?.id || 'item'}`}
          className="absolute right-0 z-50 mt-1 w-44 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl p-1 backdrop-blur-md"
        >
          {authorizedActions.map((act) => {
            const Icon = act.icon || Edit;
            return (
              <button
                key={act.id}
                type="button"
                id={`btn-action-${act.action}`}
                onClick={async () => {
                  setIsOpen(false);
                  await act.onExecute();
                }}
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-left rounded-md transition-colors cursor-pointer ${
                  act.destructive
                    ? 'text-rose-400 hover:bg-rose-500/10'
                    : 'text-zinc-200 hover:bg-zinc-800/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5 opacity-70" />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
