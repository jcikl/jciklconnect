import React, { createContext, useContext, useState, useEffect } from 'react';

// --- Types & Interfaces ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

// Fix: Add React.HTMLAttributes<HTMLDivElement> to allow passing props like onClick.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  noPadding?: boolean;
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'jci' | 'gold' | 'platinum';
  className?: string;
}

interface TabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: 'left' | 'right';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// --- Context ---
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

// --- Components ---

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`
              px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center gap-2
              ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-jci-blue text-white hover:bg-sky-600 focus:ring-jci-blue shadow-sm",
    secondary: "bg-slate-800 text-white hover:bg-slate-900 focus:ring-slate-800 shadow-sm",
    outline: "border border-slate-300 text-slate-700 hover:border-jci-blue hover:text-jci-blue focus:ring-jci-blue bg-white",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

// Fix: Destructure ...props and spread them onto the underlying div element.
export const Card: React.FC<CardProps> = ({ children, className = '', title, action, noPadding = false, ...props }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`} {...props}>
      {(title || action) && (
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          {title && <h3 className="font-semibold text-slate-800 text-base">{title}</h3>}
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
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
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${styles[variant]} ${className}`}>
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

export const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  trend?: number; 
  icon: React.ReactNode; 
  subtext?: string 
}> = ({ title, value, trend, icon, subtext }) => (
  <Card className="hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h4>
        {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
      </div>
      <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600">
        {icon}
      </div>
    </div>
    {trend !== undefined && (
      <div className="mt-4 flex items-center text-sm">
        <span className={`${trend >= 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"} font-medium px-2 py-0.5 rounded-full text-xs`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
        <span className="text-slate-400 ml-2 text-xs">vs last month</span>
      </div>
    )}
  </Card>
);

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  return (
    <div className={`border-b border-slate-200 ${className}`}>
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === tab
                ? 'border-jci-blue text-jci-blue'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
            `}
          >
            {tab}
          </button>
        ))}
      </nav>
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
  )
}

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded transition-colors">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, position = 'right' }) => {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300" 
        onClick={onClose}
      />
      <div 
        className={`
          fixed top-0 bottom-0 z-50 w-full md:w-96 bg-white shadow-2xl transition-transform duration-300 ease-in-out
          ${position === 'right' ? 'right-0' : 'left-0'}
          ${isOpen ? 'translate-x-0' : (position === 'right' ? 'translate-x-full' : '-translate-x-full')}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-900">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};