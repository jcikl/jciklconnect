import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          className={`
            block w-full rounded-lg border-slate-300 shadow-sm 
            focus:border-jci-blue focus:ring-jci-blue sm:text-sm 
            disabled:bg-slate-50 disabled:text-slate-500
            ${icon ? 'pl-10' : 'pl-3'}
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export const Select: React.FC<SelectProps> = ({ label, options, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <select
        className={`
          block w-full rounded-lg border-slate-300 shadow-sm 
          focus:border-jci-blue focus:ring-jci-blue sm:text-sm
          ${error ? 'border-red-300' : ''}
          ${className}
        `}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};
