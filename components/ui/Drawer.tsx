import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  position?: 'left' | 'right' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

// Returns all focusable elements within a container
function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
  size = 'md',
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = 'drawer-title';

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;

    // Move focus into the panel
    const panel = panelRef.current;
    if (panel) {
      const focusable = getFocusable(panel);
      if (focusable.length > 0) focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const focusable = getFocusable(panel);
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = { sm: 'md:w-80', md: 'md:w-96', lg: 'md:w-[600px]', xl: 'md:w-[800px]' };
  const heightClasses = { sm: 'max-h-[40vh]', md: 'max-h-[60vh]', lg: 'max-h-[75vh]', xl: 'max-h-[90vh]' };

  if (position === 'bottom') {
    return createPortal(
      <>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col ${heightClasses[size]} md:left-1/2 md:-translate-x-1/2 md:w-[560px] md:rounded-t-2xl`}
        >
          <div className="flex-none pt-3 pb-1 flex justify-center" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
          <div className="flex-none px-4 pb-3 flex justify-between items-center border-b border-slate-100">
            <h3 id={titleId} className="font-bold text-slate-900">{title}</h3>
            <button onClick={onClose} aria-label="Close drawer" className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && <div className="flex-none p-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">{footer}</div>}
        </div>
      </>,
      document.body
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`fixed top-0 bottom-0 z-50 w-full ${sizeClasses[size]} bg-white shadow-2xl transition-transform duration-300 ease-in-out ${position === 'right' ? 'right-0' : 'left-0'} ${isOpen ? 'translate-x-0' : (position === 'right' ? 'translate-x-full' : '-translate-x-full')}`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 id={titleId} className="font-bold text-slate-900">{title}</h3>
            <button onClick={onClose} aria-label="Close drawer" className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && <div className="flex-none p-4 border-t border-slate-100 bg-slate-50/80">{footer}</div>}
        </div>
      </div>
    </>
  );
};
