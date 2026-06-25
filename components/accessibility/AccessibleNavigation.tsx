import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { useKeyboardNavigation, useFocusManagement } from '../../hooks/useAccessibility';

/**
 * 无障碍导航组件 - 完全符合 WCAG 标准的导航菜单
 * Accessible Navigation Components - Fully WCAG compliant navigation menus
 */

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  children?: NavigationItem[];
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface AccessibleNavigationProps {
  items: NavigationItem[];
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  onItemSelect?: (item: NavigationItem) => void;
}

export const AccessibleNavigation: React.FC<AccessibleNavigationProps> = ({
  items,
  orientation = 'horizontal',
  className = '',
  onItemSelect
}) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const navRef = useRef<HTMLElement>(null);
  const { updateFocusableElements, focusNext, focusPrevious } = useFocusManagement();

  useEffect(() => {
    if (navRef.current) {
      updateFocusableElements(navRef.current);
    }
  }, [updateFocusableElements, items]);

  const handleKeyDown = (e: React.KeyboardEvent, item: NavigationItem, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        if (orientation === 'horizontal') {
          focusNext();
        } else if (item.children && !expandedItems.has(item.id)) {
          toggleExpanded(item.id);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (orientation === 'horizontal') {
          focusPrevious();
        } else if (item.children && expandedItems.has(item.id)) {
          toggleExpanded(item.id);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (orientation === 'vertical') {
          focusNext();
        } else if (item.children && !expandedItems.has(item.id)) {
          toggleExpanded(item.id);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (orientation === 'vertical') {
          focusPrevious();
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleItemActivate(item);
        break;
      case 'Escape':
        if (expandedItems.size > 0) {
          setExpandedItems(new Set());
        }
        break;
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleItemActivate = (item: NavigationItem) => {
    if (item.disabled) return;

    if (item.children) {
      toggleExpanded(item.id);
    } else {
      if (item.onClick) {
        item.onClick();
      }
      onItemSelect?.(item);
    }
  };

  const renderNavigationItem = (item: NavigationItem, index: number, level: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <li key={item.id} role="none">
        {item.href && !hasChildren ? (
          <a
            href={item.href}
            className={`
              flex items-center px-3 py-2 text-sm font-medium rounded-lg
              transition-colors focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2
              ${item.disabled 
                ? 'text-slate-400 cursor-not-allowed' 
                : 'text-slate-700 hover:text-jci-blue hover:bg-slate-50'
              }
              ${level > 0 ? 'ml-4' : ''}
            `}
            onKeyDown={(e) => handleKeyDown(e, item, index)}
            aria-disabled={item.disabled}
            tabIndex={item.disabled ? -1 : 0}
          >
            {item.icon && (
              <span className="mr-2" aria-hidden="true">
                {item.icon}
              </span>
            )}
            {item.label}
          </a>
        ) : (
          <button
            type="button"
            className={`
              w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg
              transition-colors focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2
              ${item.disabled 
                ? 'text-slate-400 cursor-not-allowed' 
                : 'text-slate-700 hover:text-jci-blue hover:bg-slate-50'
              }
              ${level > 0 ? 'ml-4' : ''}
            `}
            onClick={() => handleItemActivate(item)}
            onKeyDown={(e) => handleKeyDown(e, item, index)}
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-haspopup={hasChildren ? 'menu' : undefined}
            aria-disabled={item.disabled}
            tabIndex={item.disabled ? -1 : 0}
          >
            <span className="flex items-center">
              {item.icon && (
                <span className="mr-2" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.label}
            </span>
            {hasChildren && (
              <span aria-hidden="true">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            )}
          </button>
        )}

        {hasChildren && isExpanded && (
          <ul
            role="menu"
            aria-label={`${item.label} 子菜单`}
            className="mt-1 space-y-1"
          >
            {item.children!.map((child, childIndex) =>
              renderNavigationItem(child, childIndex, level + 1)
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav
      ref={navRef}
      className={`${className}`}
      aria-label="主导航"
    >
      <ul
        role="menubar"
        aria-orientation={orientation}
        className={`
          space-y-1
          ${orientation === 'horizontal' ? 'flex space-y-0 space-x-1' : ''}
        `}
      >
        {items.map((item, index) => renderNavigationItem(item, index))}
      </ul>
    </nav>
  );
};

/**
 * 无障碍面包屑导航组件
 * Accessible Breadcrumb Navigation Component
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  current?: boolean;
}

export interface AccessibleBreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

export const AccessibleBreadcrumb: React.FC<AccessibleBreadcrumbProps> = ({
  items,
  separator = '/',
  className = ''
}) => {
  return (
    <nav
      aria-label="面包屑导航"
      className={className}
    >
      <ol className="flex items-center space-x-2 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span 
                className="mx-2 text-slate-400" 
                aria-hidden="true"
              >
                {separator}
              </span>
            )}
            
            {item.current ? (
              <span 
                className="font-medium text-slate-900"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : item.href ? (
              <a
                href={item.href}
                className="text-jci-blue hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2 rounded"
              >
                {item.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={item.onClick}
                className="text-jci-blue hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2 rounded"
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

/**
 * 无障碍移动端导航菜单组件
 * Accessible Mobile Navigation Menu Component
 */
export interface AccessibleMobileMenuProps {
  items: NavigationItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  className?: string;
}

export const AccessibleMobileMenu: React.FC<AccessibleMobileMenuProps> = ({
  items,
  isOpen,
  onToggle,
  onClose,
  className = ''
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useKeyboardNavigation(
    isOpen ? onClose : undefined,
    undefined,
    undefined
  );

  useEffect(() => {
    if (isOpen) {
      // 焦点管理
      const firstFocusable = menuRef.current?.querySelector(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();
    } else {
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      {/* 菜单按钮 */}
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className="
          p-2 text-slate-600 hover:text-slate-900 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2
          md:hidden
        "
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        aria-label={isOpen ? '关闭菜单' : '打开菜单'}
      >
        {isOpen ? (
          <X className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6" aria-hidden="true" />
        )}
      </button>

      {/* 移动端菜单 */}
      {isOpen && (
        <>
          {/* 背景覆盖层 */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          
          {/* 菜单内容 */}
          <div
            ref={menuRef}
            id="mobile-menu"
            className={`
              fixed top-0 right-0 h-full w-80 max-w-sm bg-white shadow-xl z-50
              transform transition-transform duration-300 ease-in-out
              md:hidden
              ${className}
            `}
            role="dialog"
            aria-modal="true"
            aria-label="移动端导航菜单"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                导航菜单
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="
                  p-2 text-slate-400 hover:text-slate-600 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2
                "
                aria-label="关闭菜单"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            
            <div className="p-4">
              <AccessibleNavigation
                items={items}
                orientation="vertical"
                onItemSelect={onClose}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default {
  AccessibleNavigation,
  AccessibleBreadcrumb,
  AccessibleMobileMenu
};