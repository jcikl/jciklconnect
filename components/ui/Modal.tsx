import React from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  scrollInBody?: boolean;
  drawerOnMobile?: boolean;
  bottomSheet?: boolean;
  variant?: 'default' | 'jci';
  footer?: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  footerClassName?: string;
  headerStyle?: React.CSSProperties;
  noDragHandle?: boolean;
  dragHandleInHeader?: boolean;
  noHeader?: boolean;
  mobileHeight?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

// Returns all focusable elements within a container
function getFocusableModal(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  scrollInBody = true,
  drawerOnMobile = false,
  bottomSheet = false,
  variant = 'default',
  footer,
  header,
  className,
  footerClassName,
  headerStyle,
  noDragHandle,
  dragHandleInHeader,
  noHeader,
  mobileHeight,
  onScroll,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Initial focus — runs only when modal opens/closes, not on every render
  React.useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;
    // Focus the first input/textarea if present, otherwise fall back to first focusable
    const firstInput = container.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled])');
    const focusable = getFocusableModal(container);
    (firstInput ?? focusable[0])?.focus();
  }, [isOpen]);

  // Keyboard trap + body scroll lock — kept separate so onClose identity changes don't retrigger focus
  React.useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const container = containerRef.current;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && container) {
        const focusable = getFocusableModal(container);
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
    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    '3xl': 'max-w-7xl',
    '4xl': 'max-w-[1440px]',
    '5xl': 'max-w-[1600px]',
  };

  const modalContent = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 p-4 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`
          bg-white shadow-2xl w-full overflow-hidden flex flex-col md:rounded-xl transition-all duration-300 ease-in-out
          ${(bottomSheet || drawerOnMobile)
            ? (bottomSheet
              ? `fixed bottom-0 rounded-t-[32px] md:bottom-4 md:rounded-2xl animate-slide-up ${mobileHeight || 'max-h-[90vh]'} ${sizeClasses[size]}`
              : `fixed bottom-0 rounded-t-[32px] md:relative md:rounded-xl animate-slide-up ${mobileHeight || 'max-h-[90vh]'} ${sizeClasses[size]}`)
            : `rounded-xl max-w-[95vw] max-h-[90vh] animate-scale-in ${sizeClasses[size]}`}
          ${className || ''}
        `}
        style={!drawerOnMobile ? { maxWidth: size === 'sm' ? '448px' : size === 'md' ? '512px' : undefined } : {}}
      >
        {(bottomSheet || drawerOnMobile) && !noDragHandle && !dragHandleInHeader && (
          <div className="absolute top-0 left-0 right-0 h-10 flex items-center justify-center z-50 pointer-events-none md:hidden">
            <div className="w-12 h-1.5 bg-white/30 rounded-full" />
          </div>
        )}
        {!noHeader && title !== null && (
          <div
            className={`
              flex sticky top-0 z-10
              ${dragHandleInHeader ? 'flex-col' : 'justify-between items-center'}
              ${variant === 'jci'
                ? 'flex-none bg-gradient-to-r from-jci-blue via-sky-600 to-blue-700 px-6 py-5 text-white shadow-md'
                : 'p-4 border-b border-slate-100 bg-slate-50'}
            `}
            style={headerStyle}
          >
            {dragHandleInHeader && (
              <div className="flex justify-center pb-2 md:hidden">
                <div className="w-10 h-1 rounded-full bg-white/30" />
              </div>
            )}
            <div className={dragHandleInHeader ? 'flex justify-between items-center w-full' : 'contents'}>
              <div id="modal-title" className={variant === 'jci' ? 'flex-1' : 'font-bold text-slate-800'}>
                {typeof title === 'string' ? (
                  <h3 className={variant === 'jci' ? 'text-xl font-bold uppercase tracking-tight' : ''}>{title}</h3>
                ) : (
                  title
                )}
              </div>
              <button
                onClick={onClose}
                className={`rounded transition-all duration-200 button-press ${variant === 'jci' ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'}`}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}
        <div
          className={`p-4 md:p-6 flex-1 min-h-0 flex flex-col ${scrollInBody ? 'overflow-y-auto' : 'overflow-hidden'}`}
          onScroll={onScroll}
        >
          {children}
        </div>
        {footer && (
          <div className={footerClassName || "flex-none p-4 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm"}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
