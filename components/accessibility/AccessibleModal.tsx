import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap, useKeyboardNavigation, useAriaAnnouncements } from '../../hooks/useAccessibility';

/**
 * 无障碍模态框组件 - 完全符合 WCAG 标准的模态框
 * Accessible Modal Component - Fully WCAG compliant modal dialog
 */

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  ariaDescribedBy?: string;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  initialFocus,
  className = '',
  overlayClassName = '',
  contentClassName = '',
  ariaDescribedBy
}) => {
  const modalRef = useFocusTrap(isOpen);
  const titleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);
  const descriptionId = useRef(`modal-desc-${Math.random().toString(36).substr(2, 9)}`);
  const { announce } = useAriaAnnouncements();
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // 键盘导航处理
  useKeyboardNavigation(
    closeOnEscape ? onClose : undefined,
    undefined,
    undefined
  );

  // 尺寸映射
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  // 处理覆盖层点击
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // 模态框打开/关闭效果
  useEffect(() => {
    if (isOpen) {
      // 保存当前焦点元素
      previousActiveElement.current = document.activeElement as HTMLElement;

      // 阻止背景滚动
      document.body.style.overflow = 'hidden';

      // 向屏幕阅读器宣布模态框打开
      announce(`对话框已打开：${title}`, 'assertive');

      // 设置初始焦点
      setTimeout(() => {
        if (initialFocus?.current) {
          initialFocus.current.focus();
        } else if (modalRef.current) {
          const firstFocusable = modalRef.current.querySelector(
            'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          firstFocusable?.focus();
        }
      }, 100);
    } else {
      // 恢复背景滚动
      document.body.style.overflow = '';

      // 恢复之前的焦点
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }

      // 向屏幕阅读器宣布模态框关闭
      announce('对话框已关闭', 'assertive');
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, title, announce, initialFocus, modalRef]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId.current}
      aria-describedby={ariaDescribedBy || descriptionId.current}
    >
      {/* 背景覆盖层 */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        aria-hidden="true"
      />

      {/* 模态框内容 */}
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        className={`
          relative bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto
          ${sizeClasses[size]} w-full
          ${contentClassName}
          ${className}
        `}
        role="document"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2
            id={titleId.current}
            className="text-xl font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="
              p-2 text-slate-400 hover:text-slate-600 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2
              transition-colors
            "
            aria-label="关闭对话框"
            type="button"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* 内容区域 */}
        <div
          id={descriptionId.current}
          className="p-4"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * 无障碍确认对话框组件
 * Accessible Confirmation Dialog Component
 */
export interface AccessibleConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const AccessibleConfirmDialog: React.FC<AccessibleConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'info'
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    info: 'bg-jci-blue hover:bg-blue-700 focus:ring-jci-blue'
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      initialFocus={confirmButtonRef}
      ariaDescribedBy="confirm-dialog-message"
    >
      <div className="space-y-4">
        <p
          id="confirm-dialog-message"
          className="text-slate-600"
        >
          {message}
        </p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="
              px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 
              border border-slate-300 rounded-lg hover:bg-slate-200
              focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2
              transition-colors
            "
            type="button"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`
              px-4 py-2 text-sm font-medium text-white rounded-lg
              focus:outline-none focus:ring-2 focus:ring-offset-2
              transition-colors
              ${variantStyles[variant]}
            `}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </AccessibleModal>
  );
};

export default AccessibleModal;