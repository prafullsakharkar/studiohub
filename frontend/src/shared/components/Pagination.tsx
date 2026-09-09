import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalCount?: number;
  pageSize?: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalCount,
  pageSize = 20,
  totalPages: propTotalPages,
  onPageChange,
}) => {
  const calculatedTotalPages = propTotalPages !== undefined
    ? Math.max(1, propTotalPages)
    : Math.max(1, Math.ceil((totalCount || 0) / pageSize));

  const totalPages = calculatedTotalPages;
  const startItem = totalCount !== undefined ? (currentPage - 1) * pageSize + 1 : undefined;
  const endItem = totalCount !== undefined ? Math.min(currentPage * pageSize, totalCount) : undefined;

  if (totalPages <= 1 && totalCount === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
      <div>
        {totalCount !== undefined ? (
          <>
            Showing <span className="font-medium text-slate-700 dark:text-slate-200">{startItem}</span> to{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{endItem}</span> of{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{totalCount}</span> records
          </>
        ) : (
          <span>Page {currentPage} of {totalPages}</span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
        >
          Previous
        </Button>
        <span className="px-2 font-medium text-slate-600 dark:text-slate-300">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
