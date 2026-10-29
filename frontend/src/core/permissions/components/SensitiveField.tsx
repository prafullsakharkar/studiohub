import React from 'react';
import { Lock } from 'lucide-react';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { PermissionEvaluationContext } from '@/types/identity';
import { canAccessField } from '../fieldPermissionEngine';

export interface SensitiveFieldProps {
  id?: string;
  entityType: string;
  field: string;
  value: any;
  format?: (val: any) => React.ReactNode;
  maskPlaceholder?: string;
  context?: PermissionEvaluationContext;
  showLockIcon?: boolean;
  className?: string;
}

export const SensitiveField: React.FC<SensitiveFieldProps> = ({
  id,
  entityType,
  field,
  value,
  format,
  maskPlaceholder = '••••••••',
  context,
  showLockIcon = true,
  className = '',
}) => {
  const { user } = useCurrentUser();

  const evalContext: PermissionEvaluationContext = {
    ...context,
  };

  const isAllowed = canAccessField(user, entityType, field, 'view', evalContext);

  if (!isAllowed) {
    return (
      <span
        id={id || `restricted-field-${entityType}-${field}`}
        className={`inline-flex items-center gap-1.5 font-mono text-xs px-2 py-0.5 rounded bg-zinc-800/60 text-zinc-500 border border-zinc-700/50 select-none ${className}`}
        title={`Restricted field: ${entityType}.${field}`}
      >
        {showLockIcon && <Lock className="w-3 h-3 text-amber-500/70" />}
        <span>{maskPlaceholder}</span>
      </span>
    );
  }

  const renderedValue = format ? format(value) : value !== undefined && value !== null ? String(value) : '—';

  return (
    <span id={id || `field-${entityType}-${field}`} className={className}>
      {renderedValue}
    </span>
  );
};
