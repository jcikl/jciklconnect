import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * 无障碍相关的自定义 Hooks
 * Accessibility related custom hooks
 */

/**
 * 焦点管理 Hook - 管理组件内的焦点状态
 * Focus management Hook - Manages focus state within components
 */
export function useFocusManagement() {
  const focusableElementsRef = useRef<HTMLElement[]>([]);
  const currentFocusIndexRef = useRef<number>(-1);

  const updateFocusableElements = useCallback((container: HTMLElement) => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]:not([disabled])'
    ].join(', ');

    focusableElementsRef.current = Array.from(
      container.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];
  }, []);

  const focusFirst = useCallback(() => {
    if (focusableElementsRef.current.length > 0) {
      focusableElementsRef.current[0].focus();
      currentFocusIndexRef.current = 0;
    }
  }, []);

  const focusLast = useCallback(() => {
    const elements = focusableElementsRef.current;
    if (elements.length > 0) {
      elements[elements.length - 1].focus();
      currentFocusIndexRef.current = elements.length - 1;
    }
  }, []);

  const focusNext = useCallback(() => {
    const elements = focusableElementsRef.current;
    if (elements.length === 0) return;

    currentFocusIndexRef.current = (currentFocusIndexRef.current + 1) % elements.length;
    elements[currentFocusIndexRef.current].focus();
  }, []);

  const focusPrevious = useCallback(() => {
    const elements = focusableElementsRef.current;
    if (elements.length === 0) return;

    currentFocusIndexRef.current = 
      currentFocusIndexRef.current <= 0 
        ? elements.length - 1 
        : currentFocusIndexRef.current - 1;
    elements[currentFocusIndexRef.current].focus();
  }, []);

  return {
    updateFocusableElements,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious
  };
}

/**
 * 键盘导航 Hook - 处理键盘导航事件
 * Keyboard navigation Hook - Handles keyboard navigation events
 */
export function useKeyboardNavigation(
  onEscape?: () => void,
  onEnter?: () => void,
  onArrowKeys?: (direction: 'up' | 'down' | 'left' | 'right') => void
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
      case 'Enter':
        if (onEnter) {
          event.preventDefault();
          onEnter();
        }
        break;
      case 'ArrowUp':
        if (onArrowKeys) {
          event.preventDefault();
          onArrowKeys('up');
        }
        break;
      case 'ArrowDown':
        if (onArrowKeys) {
          event.preventDefault();
          onArrowKeys('down');
        }
        break;
      case 'ArrowLeft':
        if (onArrowKeys) {
          event.preventDefault();
          onArrowKeys('left');
        }
        break;
      case 'ArrowRight':
        if (onArrowKeys) {
          event.preventDefault();
          onArrowKeys('right');
        }
        break;
    }
  }, [onEscape, onEnter, onArrowKeys]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { handleKeyDown };
}

/**
 * ARIA 公告 Hook - 向屏幕阅读器发送公告
 * ARIA announcements Hook - Sends announcements to screen readers
 */
export function useAriaAnnouncements() {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncements(prev => [...prev, message]);
    
    // 创建临时的 aria-live 区域
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.textContent = message;
    
    document.body.appendChild(liveRegion);
    
    // 短暂延迟后移除
    setTimeout(() => {
      document.body.removeChild(liveRegion);
    }, 1000);
  }, []);

  const clearAnnouncements = useCallback(() => {
    setAnnouncements([]);
  }, []);

  return { announce, clearAnnouncements, announcements };
}

/**
 * 焦点陷阱 Hook - 将焦点限制在特定容器内
 * Focus trap Hook - Traps focus within a specific container
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);
  const { updateFocusableElements, focusFirst, focusLast } = useFocusManagement();

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    updateFocusableElements(container);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusableElements = container.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // 初始焦点
    focusFirst();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, updateFocusableElements, focusFirst]);

  return containerRef;
}

/**
 * 屏幕阅读器检测 Hook - 检测是否有屏幕阅读器在使用
 * Screen reader detection Hook - Detects if screen reader is being used
 */
export function useScreenReaderDetection() {
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);

  useEffect(() => {
    // 检测常见的屏幕阅读器指示器
    const checkScreenReader = () => {
      // 检查是否有 aria-live 区域被频繁访问
      const hasAriaLive = document.querySelectorAll('[aria-live]').length > 0;
      
      // 检查用户是否使用键盘导航
      let keyboardNavigation = false;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
          keyboardNavigation = true;
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      
      // 检查媒体查询
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      setTimeout(() => {
        setIsScreenReaderActive(hasAriaLive || keyboardNavigation || prefersReducedMotion);
        document.removeEventListener('keydown', handleKeyDown);
      }, 1000);
    };

    checkScreenReader();
  }, []);

  return isScreenReaderActive;
}

/**
 * 颜色对比度检查 Hook - 检查颜色对比度是否符合 WCAG 标准
 * Color contrast check Hook - Checks if color contrast meets WCAG standards
 */
export function useColorContrastCheck() {
  const checkContrast = useCallback((foreground: string, background: string): {
    ratio: number;
    passAA: boolean;
    passAAA: boolean;
  } => {
    // 简化的对比度计算（实际应用中应使用更精确的算法）
    const getLuminance = (color: string): number => {
      // 这里应该实现完整的亮度计算
      // 为了示例，返回一个简化的值
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    return {
      ratio,
      passAA: ratio >= 4.5,
      passAAA: ratio >= 7
    };
  }, []);

  return { checkContrast };
}

/**
 * 可访问性验证 Hook - 验证组件的可访问性
 * Accessibility validation Hook - Validates component accessibility
 */
export function useAccessibilityValidation() {
  const validateElement = useCallback((element: HTMLElement): {
    issues: string[];
    warnings: string[];
    suggestions: string[];
  } => {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 检查是否有适当的 ARIA 标签
    if (element.tagName === 'BUTTON' && !element.getAttribute('aria-label') && !element.textContent?.trim()) {
      issues.push('按钮缺少可访问的标签');
    }

    // 检查图片是否有 alt 文本
    const images = element.querySelectorAll('img');
    images.forEach(img => {
      if (!img.getAttribute('alt')) {
        issues.push('图片缺少 alt 属性');
      }
    });

    // 检查表单控件是否有标签
    const inputs = element.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        issues.push('表单控件缺少标签');
      }
    });

    // 检查链接是否有描述性文本
    const links = element.querySelectorAll('a');
    links.forEach(link => {
      const text = link.textContent?.trim();
      if (!text || text === '点击这里' || text === '更多') {
        warnings.push('链接文本不够描述性');
      }
    });

    // 建议
    if (element.getAttribute('role')) {
      suggestions.push('考虑使用语义化 HTML 元素而不是 ARIA 角色');
    }

    return { issues, warnings, suggestions };
  }, []);

  return { validateElement };
}

export default {
  useFocusManagement,
  useKeyboardNavigation,
  useAriaAnnouncements,
  useFocusTrap,
  useScreenReaderDetection,
  useColorContrastCheck,
  useAccessibilityValidation
};