import type React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Archive,
  Copy,
  XCircle,
  PlusCircle,
  Filter,
} from 'lucide-react';
import type { BulkOperationSummary, EntityResolutionState } from '@/types/production';

interface BulkValidationSummaryProps {
  summary: BulkOperationSummary;
  activeFilter?: EntityResolutionState | 'ALL';
  onFilterChange?: (filter: EntityResolutionState | 'ALL') => void;
  className?: string;
}

export const BulkValidationSummary: React.FC<BulkValidationSummaryProps> = ({
  summary,
  activeFilter = 'ALL',
  onFilterChange,
  className = '',
}) => {
  const filterPills = [
    {
      id: 'ALL' as const,
      label: 'All Items',
      count: summary.total,
      badgeColor: 'border-slate-700 bg-slate-800 text-slate-200',
    },
    {
      id: 'NEW' as const,
      label: 'New (Create)',
      count: summary.newCount,
      icon: PlusCircle,
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'SOFT_DELETED' as const,
      label: 'Soft-Deleted (Recoverable)',
      count: summary.softDeletedCount,
      icon: Archive,
      badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    },
    {
      id: 'EXISTS' as const,
      label: 'Active Existing',
      count: summary.existingCount,
      icon: AlertTriangle,
      badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    },
    {
      id: 'DUPLICATE_IN_REQUEST' as const,
      label: 'Batch Duplicates',
      count: summary.duplicateCount,
      icon: Copy,
      badgeColor: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    },
    {
      id: 'INVALID' as const,
      label: 'Validation Errors',
      count: summary.invalidCount,
      icon: XCircle,
      badgeColor: 'border-rose-500/40 bg-rose-500/20 text-rose-400',
    },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">
            Batch Validation Breakdown
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
            {summary.total} Total
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterPills.map((pill) => {
          const Icon = pill.icon;
          const isActive = activeFilter === pill.id;
          const isZero = pill.count === 0;

          return (
            <button
              key={pill.id}
              type="button"
              disabled={isZero && pill.id !== 'ALL'}
              onClick={() => onFilterChange?.(pill.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                pill.badgeColor
              } ${
                isActive
                  ? 'ring-2 ring-indigo-500 font-bold scale-[1.02]'
                  : isZero
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:opacity-90 cursor-pointer'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{pill.label}</span>
              <span className="px-1.5 py-0.2 rounded bg-black/40 text-[11px] font-bold">
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
