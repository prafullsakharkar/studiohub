import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  className?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value = '', onChange, onClear, placeholder = 'Search...', className, disabled, ...props }, ref) => {
    const handleClear = () => {
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: '' },
          currentTarget: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div className={cn('relative flex items-center', className)}>
        <Search
          className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none select-none"
          aria-hidden="true"
        />

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full pl-9 pr-8 py-1.5 text-xs bg-slate-900/80 dark:bg-slate-900/80 border border-slate-700/80',
            'rounded-lg text-slate-100 placeholder:text-slate-500',
            'focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500',
            'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          {...props}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
