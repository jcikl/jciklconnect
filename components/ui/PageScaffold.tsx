import React from 'react';
import { LoadingState } from './LoadingState';
import { PageHeader } from './PageHeader';
import { TabItem, Tabs } from './Tabs';

interface PageScaffoldTabs {
  items: TabItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  fullWidth?: boolean;
  mobileFallback?: 'scroll' | 'select' | 'pill';
  className?: string;
}

interface PageScaffoldProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tabs?: PageScaffoldTabs;
  toolbar?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export const PageScaffold: React.FC<PageScaffoldProps> = ({
  title,
  description,
  actions,
  tabs,
  toolbar,
  loading = false,
  error = null,
  empty = false,
  emptyMessage,
  onRetry,
  children,
  className = '',
  headerClassName = '',
  contentClassName = '',
}) => {
  return (
    <section className={`space-y-4 ${className}`}>
      <PageHeader
        title={title}
        description={description}
        action={actions}
        className={headerClassName}
      />

      {(tabs || toolbar) && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {tabs && (
            <Tabs
              tabs={tabs.items}
              activeTab={tabs.activeTab}
              onTabChange={tabs.onTabChange}
              fullWidth={tabs.fullWidth}
              mobileFallback={tabs.mobileFallback}
              className={tabs.className}
            />
          )}
          {toolbar && <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className={contentClassName}>
        <LoadingState
          loading={loading}
          error={error}
          empty={empty}
          emptyMessage={emptyMessage}
          onRetry={onRetry}
        >
          {children}
        </LoadingState>
      </div>
    </section>
  );
};

export type { PageScaffoldProps, PageScaffoldTabs };
