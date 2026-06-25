// FirstUseBanner – 首次使用引导（FR33, Epic 5）
// 可关闭、可复用的引导条，关闭后不再显示（localStorage）
import React, { useState, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';

const STORAGE_PREFIX = 'jci-first-use-';

export interface FirstUseBannerProps {
  /** 唯一标识，用于 localStorage 键 */
  flowId: string;
  /** 引导内容（纯文本或 React 节点） */
  children: React.ReactNode;
  /** 关闭按钮文案 */
  dismissLabel?: string;
  /** 可选的帮助链接点击回调（如打开帮助 Modal） */
  onHelpClick?: () => void;
  /** 样式变体 */
  variant?: 'info' | 'teal';
}

export const FirstUseBanner: React.FC<FirstUseBannerProps> = ({
  flowId,
  children,
  dismissLabel = '知道了',
  onHelpClick,
  variant = 'info',
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `${STORAGE_PREFIX}${flowId}`;
    const dismissed = typeof window !== 'undefined' && localStorage.getItem(key) === 'dismissed';
    setVisible(!dismissed);
  }, [flowId]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${flowId}`, 'dismissed');
    }
    setVisible(false);
  };

  if (!visible) return null;

  const bgClass = variant === 'teal'
    ? 'bg-jci-teal/10 border-jci-teal/30'
    : 'bg-jci-blue/5 border-jci-blue/20';

  return (
    <div
      role="region"
      aria-label="首次使用引导"
      className={`rounded-lg border p-4 ${bgClass} flex flex-wrap items-start justify-between gap-3`}
    >
      <div className="flex-1 min-w-0 flex items-start gap-2">
        <HelpCircle size={18} className="text-jci-navy shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm text-slate-700">{children}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onHelpClick && (
          <button
            type="button"
            onClick={onHelpClick}
            className="text-sm text-jci-blue hover:underline font-medium"
          >
            查看详细说明
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 font-medium"
          aria-label={`关闭引导，${dismissLabel}`}
        >
          <X size={16} />
          {dismissLabel}
        </button>
      </div>
    </div>
  );
};
