import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, Eye, Keyboard, Palette, Volume2 } from 'lucide-react';
import { Card } from '../ui/Common';
import { useAccessibilityValidation, useColorContrastCheck, useScreenReaderDetection } from '../../hooks/useAccessibility';

/**
 * 无障碍检查器组件 - 检查和报告页面的无障碍问题
 * Accessibility Checker Component - Checks and reports page accessibility issues
 */

interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info';
  category: 'aria' | 'keyboard' | 'color' | 'structure' | 'content';
  message: string;
  element?: HTMLElement;
  suggestion?: string;
}

export interface AccessibilityCheckerProps {
  isVisible: boolean;
  onClose: () => void;
  targetElement?: HTMLElement;
}

export const AccessibilityChecker: React.FC<AccessibilityCheckerProps> = ({
  isVisible,
  onClose,
  targetElement
}) => {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const { validateElement } = useAccessibilityValidation();
  const { checkContrast } = useColorContrastCheck();
  const isScreenReaderActive = useScreenReaderDetection();

  const scanForIssues = async () => {
    setIsScanning(true);
    setScanProgress(0);
    const foundIssues: AccessibilityIssue[] = [];

    const target = targetElement || document.body;
    const allElements = target.querySelectorAll('*');
    const totalElements = allElements.length;

    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i] as HTMLElement;
      setScanProgress((i / totalElements) * 100);

      // 检查 ARIA 问题
      await checkAriaIssues(element, foundIssues);

      // 检查键盘导航问题
      checkKeyboardIssues(element, foundIssues);

      // 检查颜色对比度问题
      checkColorContrastIssues(element, foundIssues);

      // 检查结构问题
      checkStructureIssues(element, foundIssues);

      // 检查内容问题
      checkContentIssues(element, foundIssues);

      // 模拟异步处理
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    setIssues(foundIssues);
    setScanProgress(100);
    setIsScanning(false);
  };

  const checkAriaIssues = async (element: HTMLElement, issues: AccessibilityIssue[]) => {
    const tagName = element.tagName.toLowerCase();

    // 检查按钮是否有可访问的名称
    if (tagName === 'button') {
      const hasAccessibleName =
        element.textContent?.trim() ||
        element.getAttribute('aria-label') ||
        element.getAttribute('aria-labelledby') ||
        element.querySelector('img')?.getAttribute('alt');

      if (!hasAccessibleName) {
        issues.push({
          type: 'error',
          category: 'aria',
          message: '按钮缺少可访问的名称',
          element,
          suggestion: '添加 aria-label 属性或确保按钮有文本内容'
        });
      }
    }

    // 检查图片是否有 alt 属性
    if (tagName === 'img') {
      const alt = element.getAttribute('alt');
      if (alt === null) {
        issues.push({
          type: 'error',
          category: 'aria',
          message: '图片缺少 alt 属性',
          element,
          suggestion: '为图片添加描述性的 alt 属性'
        });
      } else if (alt === '' && !element.getAttribute('role')) {
        issues.push({
          type: 'info',
          category: 'aria',
          message: '装饰性图片应该添加 role="presentation"',
          element,
          suggestion: '为装饰性图片添加 role="presentation" 或 aria-hidden="true"'
        });
      }
    }

    // 检查表单控件是否有标签
    if (['input', 'select', 'textarea'].includes(tagName)) {
      const input = element as HTMLInputElement;
      const id = input.id;
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledBy = input.getAttribute('aria-labelledby');

      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy) {
        issues.push({
          type: 'error',
          category: 'aria',
          message: '表单控件缺少标签',
          element,
          suggestion: '为表单控件添加 <label> 元素或 aria-label 属性'
        });
      }
    }

    // 检查链接是否有描述性文本
    if (tagName === 'a') {
      const link = element as HTMLAnchorElement;
      const text = link.textContent?.trim();
      const ariaLabel = link.getAttribute('aria-label');

      if ((!text || ['点击这里', '更多', '阅读更多', 'click here', 'more'].includes(text.toLowerCase())) && !ariaLabel) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: '链接文本不够描述性',
          element,
          suggestion: '使用描述链接目标的文本，或添加 aria-label 属性'
        });
      }
    }
  };

  const checkKeyboardIssues = (element: HTMLElement, issues: AccessibilityIssue[]) => {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    // 检查交互元素是否可以通过键盘访问
    const interactiveElements = ['button', 'a', 'input', 'select', 'textarea'];
    const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio'];

    if (interactiveElements.includes(tagName) || (role && interactiveRoles.includes(role))) {
      const tabIndex = element.getAttribute('tabindex');
      const isDisabled = element.hasAttribute('disabled');

      if (tabIndex === '-1' && !isDisabled) {
        issues.push({
          type: 'warning',
          category: 'keyboard',
          message: '交互元素被排除在键盘导航之外',
          element,
          suggestion: '移除 tabindex="-1" 或确保元素可以通过其他方式访问'
        });
      }

      // 检查是否有点击事件但没有键盘事件
      const hasClickHandler = element.onclick || element.getAttribute('onclick');
      const hasKeyHandler = element.onkeydown || element.onkeyup || element.getAttribute('onkeydown') || element.getAttribute('onkeyup');

      if (hasClickHandler && !hasKeyHandler && tagName !== 'button' && tagName !== 'a') {
        issues.push({
          type: 'error',
          category: 'keyboard',
          message: '元素有点击事件但缺少键盘事件处理',
          element,
          suggestion: '添加 onKeyDown 事件处理器以支持键盘操作'
        });
      }
    }
  };

  const checkColorContrastIssues = (element: HTMLElement, issues: AccessibilityIssue[]) => {
    const computedStyle = window.getComputedStyle(element);
    const color = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;
    const fontSize = parseFloat(computedStyle.fontSize);

    // 只检查有文本内容的元素
    if (element.textContent?.trim() && color && backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      try {
        // 简化的颜色对比度检查
        const rgbToHex = (rgb: string): string => {
          const match = rgb.match(/\d+/g);
          if (!match) return '#000000';

          const [r, g, b] = match.map(Number);
          return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        };

        const foregroundHex = rgbToHex(color);
        const backgroundHex = rgbToHex(backgroundColor);

        const contrast = checkContrast(foregroundHex, backgroundHex);
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && computedStyle.fontWeight === 'bold');
        const requiredRatio = isLargeText ? 3 : 4.5;

        if (contrast.ratio < requiredRatio) {
          issues.push({
            type: 'error',
            category: 'color',
            message: `颜色对比度不足 (${contrast.ratio.toFixed(2)}:1，需要 ${requiredRatio}:1)`,
            element,
            suggestion: '调整前景色或背景色以提高对比度'
          });
        }
      } catch (error) {
        // 忽略颜色解析错误
      }
    }
  };

  const checkStructureIssues = (element: HTMLElement, issues: AccessibilityIssue[]) => {
    const tagName = element.tagName.toLowerCase();

    // 检查标题层级
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      const level = parseInt(tagName.charAt(1));
      const previousHeading = element.previousElementSibling;

      if (previousHeading && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(previousHeading.tagName.toLowerCase())) {
        const prevLevel = parseInt(previousHeading.tagName.charAt(1));
        if (level > prevLevel + 1) {
          issues.push({
            type: 'warning',
            category: 'structure',
            message: '标题层级跳跃过大',
            element,
            suggestion: '确保标题层级是连续的（如 h2 后面应该是 h3，而不是 h4）'
          });
        }
      }
    }

    // 检查列表结构
    if (tagName === 'li') {
      const parent = element.parentElement;
      if (!parent || !['ul', 'ol'].includes(parent.tagName.toLowerCase())) {
        issues.push({
          type: 'error',
          category: 'structure',
          message: 'li 元素必须是 ul 或 ol 的直接子元素',
          element,
          suggestion: '将 li 元素放在 ul 或 ol 元素内'
        });
      }
    }
  };

  const checkContentIssues = (element: HTMLElement, issues: AccessibilityIssue[]) => {
    const text = element.textContent?.trim();

    if (text) {
      // 检查是否使用了颜色作为唯一的信息传达方式
      const style = window.getComputedStyle(element);
      const color = style.color;

      if (text.includes('红色') || text.includes('绿色') || text.includes('蓝色')) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: '不要仅依赖颜色来传达信息',
          element,
          suggestion: '除了颜色外，还应使用文本、图标或其他视觉提示'
        });
      }

      // 检查文本是否过小
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < 12) {
        issues.push({
          type: 'warning',
          category: 'content',
          message: '文字过小，可能难以阅读',
          element,
          suggestion: '使用至少 12px 的字体大小'
        });
      }
    }
  };

  useEffect(() => {
    if (isVisible) {
      scanForIssues();
    }
  }, [isVisible, targetElement]);

  const getIssueIcon = (type: AccessibilityIssue['type']) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: AccessibilityIssue['category']) => {
    switch (category) {
      case 'aria':
        return <Volume2 className="w-4 h-4" />;
      case 'keyboard':
        return <Keyboard className="w-4 h-4" />;
      case 'color':
        return <Palette className="w-4 h-4" />;
      case 'structure':
      case 'content':
        return <Eye className="w-4 h-4" />;
    }
  };

  const groupedIssues = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) {
      acc[issue.category] = [];
    }
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, AccessibilityIssue[]>);

  const categoryNames = {
    aria: 'ARIA 和语义',
    keyboard: '键盘导航',
    color: '颜色对比度',
    structure: '页面结构',
    content: '内容质量'
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center">
              <Eye className="mr-2" />
              无障碍检查器
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* 扫描进度 */}
          {isScanning && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">正在扫描页面...</span>
                <span className="text-sm text-slate-600">{Math.round(scanProgress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-jci-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 概览统计 */}
          {!isScanning && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                  <div>
                    <p className="text-sm text-slate-600">错误</p>
                    <p className="text-2xl font-bold text-red-600">
                      {issues.filter(i => i.type === 'error').length}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-500 mr-3" />
                  <div>
                    <p className="text-sm text-slate-600">警告</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {issues.filter(i => i.type === 'warning').length}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center">
                  <Info className="h-8 w-8 text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm text-slate-600">建议</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {issues.filter(i => i.type === 'info').length}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
                  <div>
                    <p className="text-sm text-slate-600">屏幕阅读器</p>
                    <p className="text-sm font-bold text-green-600">
                      {isScreenReaderActive ? '已检测到' : '未检测到'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 问题列表 */}
          {!isScanning && (
            <div className="space-y-6">
              {Object.entries(groupedIssues).map(([category, categoryIssues]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center">
                    {getCategoryIcon(category as AccessibilityIssue['category'])}
                    <span className="ml-2">
                      {categoryNames[category as keyof typeof categoryNames]}
                      ({categoryIssues.length})
                    </span>
                  </h3>

                  <div className="space-y-2">
                    {categoryIssues.map((issue, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-start space-x-3">
                          {getIssueIcon(issue.type)}
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">
                              {issue.message}
                            </p>
                            {issue.suggestion && (
                              <p className="text-sm text-slate-600 mt-1">
                                建议: {issue.suggestion}
                              </p>
                            )}
                            {issue.element && (
                              <p className="text-xs text-slate-400 mt-2">
                                元素: {issue.element.tagName.toLowerCase()}
                                {issue.element.className && ` .${issue.element.className.split(' ')[0]}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

              {issues.length === 0 && !isScanning && (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    太棒了！
                  </h3>
                  <p className="text-slate-600">
                    没有发现明显的无障碍问题。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              onClick={scanForIssues}
              disabled={isScanning}
              className="px-4 py-2 text-sm font-medium text-jci-blue bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              {isScanning ? '扫描中...' : '重新扫描'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              关闭
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AccessibilityChecker;