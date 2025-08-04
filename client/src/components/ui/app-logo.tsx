import React from 'react';
import logoSrc from '@/../../logo_assets/logo.png';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  // landing header needs 56px, sidebar needs 40px per feedback
  size?: 'sm' | 'md' | 'lg' | 'xl' | '56' | '40';
  className?: string;
}

const sizeClasses: Record<NonNullable<AppLogoProps['size']>, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
  '56': 'h-14 w-14', // 56px
  '40': 'h-10 w-10', // 40px
};

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  className,
}) => {
  // Bust cache in dev to avoid stale image when replacing the file
  const cacheBuster = typeof window !== 'undefined' && (import.meta as any)?.hot ? `?v=${Date.now()}` : '';
  return (
    <img
      src={`${logoSrc}${cacheBuster}`}
      alt="App Logo"
      className={cn('object-contain', sizeClasses[size], className)}
    />
  );
};