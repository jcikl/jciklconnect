// Responsive Utility Components
import React from 'react';

interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: { default?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gap?: number;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 6,
  className = '',
}) => {
  const gridCols = [
    cols.default ? `grid-cols-${cols.default}` : '',
    cols.sm ? `sm:grid-cols-${cols.sm}` : '',
    cols.md ? `md:grid-cols-${cols.md}` : '',
    cols.lg ? `lg:grid-cols-${cols.lg}` : '',
    cols.xl ? `xl:grid-cols-${cols.xl}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`grid ${gridCols} gap-${gap} ${className}`}>
      {children}
    </div>
  );
};

interface MobileOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileOnly: React.FC<MobileOnlyProps> = ({ children, className = '' }) => {
  return (
    <div className={`md:hidden ${className}`}>
      {children}
    </div>
  );
};

interface DesktopOnlyProps {
  children: React.ReactNode;
  className?: string;
}

export const DesktopOnly: React.FC<DesktopOnlyProps> = ({ children, className = '' }) => {
  return (
    <div className={`hidden md:block ${className}`}>
      {children}
    </div>
  );
};

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
};

