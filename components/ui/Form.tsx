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
  label?: string | React.ReactNode;
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

export const Input: React.FC<InputProps> = ({ label, error, icon, helperText, className = '', type, onChange, onBlur, ...props }) => {
  const inputId = (props as { id?: string }).id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() + '-field' : undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const displayError = error ?? emailError;

  const EMAIL_RE = /[^a-zA-Z0-9@._+\-]/g;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === 'date' && e.target.value) {
      const parts = e.target.value.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].slice(-4);
        e.target.value = parts.join('-');
      }
    }
    if (type === 'email') {
      const filtered = e.target.value.replace(EMAIL_RE, '');
      if (filtered !== e.target.value) {
        e.target.value = filtered;
        // Pass synthetic event with filtered value so parent state setter gets clean value
        onChange?.({ ...e, target: { ...e.target, value: filtered } } as React.ChangeEvent<HTMLInputElement>);
        return;
      }
    }
    onChange?.(e);
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (type !== 'email') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Backspace','Delete','Tab','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
    if (!/^[a-zA-Z0-9@._+\-]$/.test(e.key)) e.preventDefault();
  };

  const handleEmailPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (type !== 'email') return;
    e.preventDefault();
    const filtered = e.clipboardData.getData('text').replace(EMAIL_RE, '');
    document.execCommand('insertText', false, filtered);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (type === 'email' && e.target.value) {
      setEmailError(EMAIL_FORMAT_RE.test(e.target.value) ? undefined : 'Invalid email address');
    } else {
      setEmailError(undefined);
    }
    onBlur?.(e);
  };

  const handleEmailCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    if (type !== 'email') return;
    const input = e.currentTarget;
    const filtered = input.value.replace(EMAIL_RE, '');
    if (filtered !== input.value) {
      // Force DOM value then fire React's onChange via native input event
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, filtered);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
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
          id={inputId}
          type={inputType}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleEmailKeyDown}
          onPaste={handleEmailPaste}
          onCompositionEnd={handleEmailCompositionEnd}
          className={`
            block w-full rounded-lg border-slate-300 shadow-sm py-2
            focus:border-jci-blue focus:ring-2 focus:ring-jci-blue/20 sm:text-sm
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            transition-colors
            ${icon ? 'pl-10' : 'pl-3'}
            ${isPassword ? 'pr-10' : 'pr-3'}
            ${displayError ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-300'}
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
      {displayError && <p className="mt-1 text-sm text-red-600">{displayError}</p>}
      {helperText && !displayError && <p className="mt-1 text-sm text-slate-500">{helperText}</p>}
    </div>
  );
};

export const Select: React.FC<SelectProps> = ({ label, options, error, helperText, className = '', ...props }) => {
  const selectId = (props as { id?: string }).id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() + '-select' : undefined);
  const listboxId = selectId ? selectId + '-listbox' : undefined;
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  // Support both controlled and uncontrolled
  const [internalValue, setInternalValue] = useState<string>((props.value as string) || props.defaultValue || '');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

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
        top: rect.bottom,
        left: rect.left,
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

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); setFocusedIndex(0); return; }
      const newIndex = e.key === 'ArrowDown'
        ? Math.min(focusedIndex + 1, options.length - 1)
        : Math.max(focusedIndex - 1, 0);
      setFocusedIndex(newIndex);
      optionRefs.current[newIndex]?.focus();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
      if (!isOpen) setFocusedIndex(0);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, idx: number, opt: { label: string; value: string }) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.min(idx + 1, options.length - 1); setFocusedIndex(next); optionRefs.current[next]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const prev = Math.max(idx - 1, 0); setFocusedIndex(prev); optionRefs.current[prev]?.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOption(opt); }
    else if (e.key === 'Escape') { setIsOpen(false); buttonRef.current?.focus(); }
    else if (e.key === 'Tab') { setIsOpen(false); }
  };

  const selectOption = (opt: { label: string; value: string }) => {
    const syntheticEvent = {
      target: { value: opt.value, name: props.name || '' },
      currentTarget: { value: opt.value, name: props.name || '' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as React.ChangeEvent<HTMLSelectElement>;
    if (props.value === undefined) setInternalValue(opt.value);
    props.onChange?.(syntheticEvent);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative group">
        <button
          ref={buttonRef}
          id={selectId}
          type="button"
          onClick={() => { setIsOpen(!isOpen); if (!isOpen) setFocusedIndex(0); }}
          onKeyDown={handleButtonKeyDown}
          disabled={props.disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
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
          id={listboxId}
          role="listbox"
          aria-label={label}
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
            options.map((opt, idx) => (
              <div
                key={opt.value}
                ref={el => { optionRefs.current[idx] = el; }}
                role="option"
                aria-selected={internalValue === opt.value}
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); selectOption(opt); }}
                onKeyDown={(e) => handleOptionKeyDown(e, idx, opt)}
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
  const textareaId = (props as { id?: string }).id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() + '-textarea' : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
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
    <div className="w-fit">
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
              checked={value === opt.value}
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