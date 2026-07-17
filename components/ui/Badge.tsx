import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'jci' | 'gold' | 'platinum';
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', icon, className = '', onClick }) => {
  const styles = {
    success: "bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20",
    warning: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    error: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20",
    info: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-600/20",
    neutral: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/20",
    jci: "bg-sky-100 text-jci-blue ring-1 ring-inset ring-sky-600/20",
    gold: "bg-yellow-100 text-yellow-800 ring-1 ring-inset ring-yellow-600/20",
    platinum: "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-600/20 border border-slate-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${styles[variant]} ${className}`}
      onClick={onClick}
    >
      {icon && <span className="mr-1 inline-flex items-center">{icon}</span>}
      {children}
    </span>
  );
};

export const ProgressBar: React.FC<{ progress: number; color?: string; label?: string }> = ({ progress, color = 'bg-jci-blue', label }) => {
  return (
    <div className="w-full">
      {label && <div className="flex justify-between mb-1 text-xs text-slate-500">
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        ></div>
      </div>
    </div>
  );
};

export const AvatarGroup: React.FC<{ count: number; limit?: number }> = ({ count, limit = 3 }) => {
  return (
    <div className="flex -space-x-2">
      {[...Array(Math.min(count, limit))].map((_, i) => (
        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs text-slate-500">
          ?
        </div>
      ))}
      {count > limit && (
        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
          +{count - limit}
        </div>
      )}
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string; rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' }> = ({ className = '', rounded = 'md' }) => {
  const r = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl', '2xl': 'rounded-2xl', full: 'rounded-full' }[rounded];
  return <div className={`animate-pulse bg-slate-100 ${r} ${className}`} />;
};
