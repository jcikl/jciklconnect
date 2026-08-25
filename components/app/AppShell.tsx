import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarItem } from '../layout/SidebarItem';
import {
  SidebarNavigationContext,
  SidebarNavigationSection,
  sidebarNavigationSections,
} from './navigationConfig';
import { ViewType } from '../../types/views';

interface AppShellProps {
  children: React.ReactNode;
  currentView: ViewType;
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  navigationContext: SidebarNavigationContext;
  onCloseSidebar: () => void;
  onToggleSidebarCollapsed: () => void;
  onNavigate: (view: ViewType) => void;
  onDirectNavigate: (view: ViewType) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentView,
  isSidebarOpen,
  isSidebarCollapsed,
  navigationContext,
  onCloseSidebar,
  onToggleSidebarCollapsed,
  onNavigate,
  onDirectNavigate,
}) => {
  const renderSidebarSection = (section: SidebarNavigationSection) => {
    if (section.visible && !section.visible(navigationContext)) return null;

    const visibleItems = section.items.filter(item => !item.visible || item.visible(navigationContext));
    if (visibleItems.length === 0) return null;

    const content = (
      <>
        {section.label && (
          <p className={`px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            {section.label}
          </p>
        )}
        {visibleItems.map(item => (
          <SidebarItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            isActive={(item.activeViews ?? [item.view]).includes(currentView)}
            onClick={() => {
              if (item.navigateMode === 'direct') {
                onDirectNavigate(item.view);
              } else {
                onNavigate(item.view);
              }
              onCloseSidebar();
            }}
            isCollapsed={isSidebarCollapsed}
          />
        ))}
      </>
    );

    if (!section.label) return <React.Fragment key={section.id}>{content}</React.Fragment>;

    return (
      <div key={section.id} className={`pt-4 mt-4 border-t border-slate-100 ${section.inset ? 'px-2' : ''}`}>
        {content}
      </div>
    );
  };

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onCloseSidebar}
          role="presentation"
          aria-hidden="true"
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative md:flex
        ${isSidebarCollapsed ? 'w-40' : 'w-64'}
      `}>
        <div className="h-full flex flex-col min-h-0">
          <div className={`h-16 flex items-center border-b border-slate-100 flex-shrink-0 transition-all duration-200 ${isSidebarCollapsed ? 'pl-4 justify-center' : 'pl-6 justify-between'}`}>
            {!isSidebarCollapsed && (
              <img
                src="/JCI Kuala Lumpur-transparent.png"
                alt="JCI Kuala Lumpur Logo"
                className="h-8 w-auto object-contain"
              />
            )}
            {isSidebarCollapsed && (
              <img
                src="/JCI-logo-only.png"
                alt="JCI Logo"
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.src = '/JCI Kuala Lumpur-transparent.png';
                }}
              />
            )}
            <button
              onClick={onToggleSidebarCollapsed}
              className="hidden md:flex rounded-lg text-slate-400 items-center hover:text-jci-blue transition-colors"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden min-h-0">
            {sidebarNavigationSections.map(renderSidebarSection)}
          </nav>
        </div>
      </aside>

      <main id="main-content" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" tabIndex={-1} role="main">
        {children}
      </main>
    </div>
  );
};
