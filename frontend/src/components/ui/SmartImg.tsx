import React, { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface SmartImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  alt?: string;
  placeholderClassName?: string;
}

/**
 * <img> that never emits an empty `src`. When `src` is null/undefined/empty
 * (or fails to load) it renders a neutral placeholder instead, avoiding the
 * browser "empty src" warning and broken-image glyph.
 */
export const SmartImg: React.FC<SmartImgProps> = ({
  src,
  alt,
  className,
  placeholderClassName,
  onError,
  ...rest
}) => {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  if (showPlaceholder) {
    return (
      <div
        role="img"
        aria-label={alt || ''}
        className={cn(
          'flex items-center justify-center bg-slate-800 text-slate-500',
          className,
          placeholderClassName
        )}
      >
        <ImageIcon className="w-1/3 h-1/3" aria-hidden />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      className={className}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
};
