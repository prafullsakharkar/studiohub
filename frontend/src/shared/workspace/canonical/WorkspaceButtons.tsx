import type React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ExternalLink, PanelRightOpen } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface WorkspaceOpenButtonProps {
  id?: string;
  to?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'default';
  className?: string;
  showIcon?: boolean;
  disabled?: boolean;
  target?: string;
  rel?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

export const WorkspaceOpenButton: React.FC<WorkspaceOpenButtonProps> = ({
  id,
  to,
  onClick,
  title = 'Open Workspace',
  label,
  icon,
  size = 'xs',
  variant = 'secondary',
  className = '',
  showIcon = true,
  disabled = false,
  target,
  rel,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}) => {
  const navigate = useNavigate();

  const sizeClasses = {
    xs: label ? 'px-2.5 py-1 text-xs gap-1.5' : 'p-1.5 text-xs',
    sm: label ? 'px-3 py-1.5 text-xs gap-2' : 'p-2 text-xs',
    md: label ? 'px-3.5 py-2 text-sm gap-2' : 'p-2.5 text-sm',
  }[size];

  const variantClasses = {
    primary:
      'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 border border-indigo-500/30',
    secondary:
      'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 hover:border-slate-700',
    outline:
      'bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-slate-100 border border-slate-700/80 hover:border-slate-600',
    ghost:
      'bg-transparent hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-transparent',
    default:
      'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800',
  }[variant];

  const baseClasses = cn(
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 select-none cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
    sizeClasses,
    variantClasses,
    className
  );

  const defaultIcon = icon || (
    <ArrowUpRight className={cn('shrink-0', size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
  );

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      onClick(e);
    }
    if (to && !target && !e.defaultPrevented) {
      navigate(to);
    }
  };

  if (to) {
    return (
      <Link
        id={id}
        to={disabled ? '#' : to}
        target={target}
        rel={rel}
        className={baseClasses}
        title={title}
        aria-label={ariaLabel || (typeof label === 'string' ? label : title)}
        data-testid={dataTestId}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (onClick) {
            onClick(e);
          }
        }}
      >
        {label && <span>{label}</span>}
        {showIcon && defaultIcon}
      </Link>
    );
  }

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={baseClasses}
      title={title}
      aria-label={ariaLabel || (typeof label === 'string' ? label : title)}
      data-testid={dataTestId}
    >
      {label && <span>{label}</span>}
      {showIcon && defaultIcon}
    </button>
  );
};
