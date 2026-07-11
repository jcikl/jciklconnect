import React from 'react';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  noPadding?: boolean;
  noHeaderPadding?: boolean;
  description?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action, noPadding = false, noHeaderPadding = false, description, ...props }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${props.onClick ? 'cursor-pointer hover:shadow-md transition-all active:scale-[0.98]' : ''} ${className}`} {...props}>
      {(title || action || description) && (
        <div className={`border-b border-slate-100 flex justify-between items-center bg-slate-50/50 ${noHeaderPadding ? '' : 'px-4 py-4'}`}>
          {title && (
            <div>
              <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
              {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
            </div>
          )}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};

export const StatCard: React.FC<{
  title: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
  subtext?: string;
  onClick?: () => void;
}> = ({ title, value, trend, icon, subtext, onClick }) => (
  <Card onClick={onClick} className="hover:shadow-md transition-shadow min-w-0">
    <div className="flex items-start justify-between gap-1 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs md:text-sm font-medium text-slate-500 mb-0.5 md:mb-1 truncate">{title}</p>
        <h4 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight truncate">{value}</h4>
        {subtext && <p className="text-xs text-slate-400 mt-0.5 md:mt-1 truncate">{subtext}</p>}
      </div>
      <div className="p-1.5 md:p-2.5 bg-slate-50 rounded-lg text-slate-600 flex-shrink-0">
        {icon}
      </div>
    </div>
  </Card>
);

export const StatCardsContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4 ${className}`}>
    {React.Children.map(children, (child) => (
      <div className="w-full">
        {child}
      </div>
    ))}
  </div>
);
