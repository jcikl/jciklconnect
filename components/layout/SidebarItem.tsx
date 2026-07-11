import React from 'react';

export const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isCollapsed?: boolean;
}> = ({ icon, label, isActive, onClick, isCollapsed }) => (
  <button
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={`w-full flex items-center transition-all duration-200 rounded-lg text-sm font-medium ${isCollapsed ? 'justify-center px-0 py-3' : 'space-x-3 px-4 py-3'} ${isActive ? 'bg-jci-blue text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
  >
    <div className="flex-shrink-0">{icon}</div>
    {!isCollapsed && <span className="truncate">{label}</span>}
  </button>
);
