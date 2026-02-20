import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
  error?: string;
  helperText?: string;
  defaultValue?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

interface RadioGroupProps {
  label?: string;
  name: string;
  options: { label: string; value: string }[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, helperText, className = '', type, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          type={inputType}
          className={`
            block w-full rounded-lg border-slate-300 shadow-sm py-2
            focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 sm:text-sm 
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            transition-colors
            ${icon ? 'pl-10' : 'pl-3'}
            ${isPassword ? 'pr-10' : 'pr-3'}
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300'}
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff size={18} className="cursor-pointer" />
            ) : (
              <Eye size={18} className="cursor-pointer" />
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
    </div>
  );
};

export const Select: React.FC<SelectProps> = ({ label, options, error, helperText, className = '', ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  // Support both controlled and uncontrolled
  const [internalValue, setInternalValue] = useState<string>((props.value as string) || props.defaultValue || '');

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === internalValue);

  // Synchronize internal value with controlled prop
  useEffect(() => {
    if (props.value !== undefined) {
      setInternalValue(props.value as string);
    }
  }, [props.value]);

  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current && isOpen) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // 检查点击是否在容器内
      const clickedInContainer = containerRef.current && containerRef.current.contains(e.target as Node);
      // 检查点击是否在下拉菜单内
      const clickedInDropdown = dropdownRef.current && dropdownRef.current.contains(e.target as Node);

      // 只有当点击既不在容器内也不在下拉菜单内时，才关闭
      if (!clickedInContainer && !clickedInDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
    }
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative group">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={props.disabled}
          className={`
            block w-full rounded-lg border-slate-300 shadow-sm py-2 px-3 text-left
            focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 sm:text-sm
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            transition-colors
            h-auto min-h-[38px]
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300'}
            ${className}
          `}
        >
          <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
            {selectedOption ? selectedOption.label : 'Select...'}
          </span>
        </button>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-slate-400 hover:text-slate-600"
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {/* Hidden input for form data support */}
        <input
          type="hidden"
          name={props.name}
          value={internalValue}
          required={props.required}
        />
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] mt-1 rounded-lg border border-slate-200 bg-white shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: '240px',
            overflow: 'auto'
          }}
        >
          {options.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-slate-400 italic">No options available</p>
            </div>
          ) : (
            options.map((opt) => (
              <div
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  // Create a proper synthetic event object
                  const syntheticEvent = {
                    target: {
                      value: opt.value,
                      name: props.name || ''
                    },
                    currentTarget: {
                      value: opt.value,
                      name: props.name || ''
                    },
                    preventDefault: () => { },
                    stopPropagation: () => { }
                  } as React.ChangeEvent<HTMLSelectElement>;

                  if (props.value === undefined) {
                    setInternalValue(opt.value);
                  }

                  props.onChange?.(syntheticEvent);
                  setIsOpen(false);
                }}
                className={`
                  px-3 py-2 text-sm cursor-pointer transition-colors
                  ${internalValue === opt.value
                    ? 'bg-jci-blue/10 text-jci-blue font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'}
                `}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>,
        document.body
      )
      }

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
    </div >
  );
};

export const Textarea: React.FC<TextareaProps> = ({ label, error, helperText, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        className={`
          block w-full rounded-lg border-slate-300 shadow-sm py-2 px-3
          focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 sm:text-sm
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          transition-colors resize-vertical min-h-[100px]
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
    </div>
  );
};

export const Checkbox: React.FC<CheckboxProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className={`
            w-4 h-4 rounded border-slate-300 text-jci-blue
            focus:ring-2 focus:ring-jci-blue/20
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-300' : ''}
            ${className}
          `}
          {...props}
        />
        {label && (
          <span className="text-sm text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </span>
        )}
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export const RadioGroup: React.FC<RadioGroupProps> = ({ label, name, options, value, onChange, error }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
        </label>
      )}
      <div className="space-y-2">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange?.(e.target.value)}
              className={`
                w-4 h-4 border-slate-300 text-jci-blue
                focus:ring-2 focus:ring-jci-blue/20
                ${error ? 'border-red-300' : ''}
              `}
            />
            <span className="text-sm text-slate-700">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

interface ButtonGroupProps {
  label?: string;
  name: string;
  options: { label: string; value: string }[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  required?: boolean;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ label, name, options, value, onChange, error, required }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              defaultChecked={value === opt.value}
              onChange={(e) => onChange?.(e.target.value)}
              className="hidden"
            />
            <span
              className={`
                inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors
                border-2
                ${error ? 'border-red-300' : ''}
              `}
              style={{
                backgroundColor: value === opt.value ? '#0097D7' : 'white',
                color: value === opt.value ? 'white' : '#475569',
                borderColor: value === opt.value ? '#0097D7' : '#cbd5e1'
              }}
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};