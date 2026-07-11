import React, { createContext, useContext, useState } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// Singleton guard survives HMR and multiple module loads
const ToastContext: React.Context<ToastContextType | undefined> = (() => {
  const globalKey = '__JCI_TOAST_CONTEXT__';
  if (typeof window !== 'undefined') {
    if (!(window as any)[globalKey]) {
      (window as any)[globalKey] = createContext<ToastContextType | undefined>(undefined);
    }
    return (window as any)[globalKey];
  }
  return createContext<ToastContextType | undefined>(undefined);
})();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }[]>([]);
  const toastCounterRef = React.useRef(0);

  const showToast = React.useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    toastCounterRef.current += 1;
    const id = `toast-${Date.now()}-${toastCounterRef.current}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const contextValue = React.useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center gap-2
              ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : toast.type === 'warning' ? 'bg-yellow-600' : 'bg-slate-800'}
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
