import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Hash, Tag } from 'lucide-react';
import type { WorkspaceAction, BreadcrumbItem } from './types';
import { WorkspaceActionBar } from './WorkspaceActionBar';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';

export interface WorkspaceHeaderMetadataItem {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  className?: string;
}

export interface WorkspaceHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  code?: string;
  status?: string;
  priority?: string;
  avatar?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
  metadata?: WorkspaceHeaderMetadataItem[];
  actions?: WorkspaceAction[];
  tags?: string[];
  className?: string;
  children?: React.ReactNode;
}

const renderHeaderIcon = (
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode,
  className = 'w-3.5 h-3.5'
): React.ReactNode => {
  if (!icon) return null;
  if (React.isValidElement(icon)) {
    return icon;
  }
  if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && ('render' in icon || '$$typeof' in icon))
  ) {
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return <IconComp className={className} />;
  }
  return null;
};

export const CanonicalWorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  title,
  subtitle,
  code,
  status,
  priority,
  avatar,
  breadcrumbs = [],
  backTo,
  backLabel = 'Back',
  onBack,
  metadata = [],
  actions = [],
  tags = [],
  className = '',
  children,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn('bg-slate-900 border-b border-slate-800/80 px-6 py-4 select-none', className)}>
      {/* Top Row: Navigation & Breadcrumbs */}
      {(backTo || onBack || breadcrumbs.length > 0) && (
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
          {(backTo || onBack) && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors mr-2 cursor-pointer font-medium"
              title={backLabel}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{backLabel}</span>
            </button>
          )}

          {breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar" aria-label="Breadcrumb">
              {(backTo || onBack) && <span className="text-slate-600">/</span>}
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                const Icon = crumb.icon;

                return (
                  <React.Fragment key={crumb.label + idx}>
                    {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />}
                    <div className="flex items-center gap-1 shrink-0">
                      {Icon && (
                        <span className="text-slate-500">
                          {renderHeaderIcon(Icon, 'w-3 h-3')}
                        </span>
                      )}
                      {crumb.href && !isLast ? (
                        <Link
                          to={crumb.href}
                          className="hover:text-slate-200 transition-colors font-medium truncate max-w-[150px]"
                        >
                          {crumb.label}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            'truncate max-w-[200px]',
                            isLast ? 'text-slate-200 font-semibold' : 'text-slate-400'
                          )}
                        >
                          {crumb.label}
                        </span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </nav>
          )}
        </div>
      )}

      {/* Main Header Content */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Entity Title, Avatar, Badges */}
        <div className="flex items-start gap-4 min-w-0">
          {avatar && <div className="shrink-0 pt-0.5">{avatar}</div>}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white truncate font-display">
                {title}
              </h1>

              {code && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
                  <Hash className="w-3 h-3 text-slate-400" />
                  {code}
                </span>
              )}

              {status && <StatusBadge status={status} size="sm" />}

              {priority && (
                <Badge
                  variant={
                    priority.toLowerCase() === 'high' || priority.toLowerCase() === 'critical'
                      ? 'destructive'
                      : priority.toLowerCase() === 'medium'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {priority} Priority
                </Badge>
              )}

              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700/40"
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>

            {subtitle && (
              <p className="mt-1 text-xs md:text-sm text-slate-400 line-clamp-1">{subtitle}</p>
            )}

            {/* Metadata Badges */}
            {metadata.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {metadata.map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.label + i}
                      className={cn('inline-flex items-center gap-1.5', item.className)}
                    >
                      {ItemIcon && (
                        <span className="text-slate-500">
                          {renderHeaderIcon(ItemIcon, 'w-3.5 h-3.5')}
                        </span>
                      )}
                      <span className="text-slate-500 font-medium">{item.label}:</span>
                      <span className="text-slate-200 font-medium">{item.value}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Actions & Extra widgets */}
        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          {actions.length > 0 && <WorkspaceActionBar actions={actions} size="sm" />}
          {children}
        </div>
      </div>
    </div>
  );
};

export const WorkspaceHeader = CanonicalWorkspaceHeader;
