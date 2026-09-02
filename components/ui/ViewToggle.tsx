import React from 'react';

interface ViewToggleOption {
  id: string;
  icon: React.ReactNode;
  label: string;
}

interface ViewToggleProps {
  options: ViewToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ options, value, onChange, className }) => (
  <div className={`flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200${className ? ` ${className}` : ''}`}>
    {options.map(({ id, icon, label }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        aria-label={label}
        title={label}
        className={`p-1.5 rounded-md transition-colors ${value === id ? 'bg-white text-jci-blue shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
      >
        {icon}
      </button>
    ))}
  </div>
);
