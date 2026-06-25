import React, { useState, useRef, useId } from 'react';
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useAriaAnnouncements } from '../../hooks/useAccessibility';

/**
 * 无障碍表单组件 - 完全符合 WCAG 标准的表单控件
 * Accessible Form Components - Fully WCAG compliant form controls
 */

export interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  showRequiredIndicator?: boolean;
}

export const AccessibleInput: React.FC<AccessibleInputProps> = ({
  label,
  error,
  helpText,
  required = false,
  showRequiredIndicator = true,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const { announce } = useAriaAnnouncements();

  const handleInvalid = () => {
    if (error) {
      announce(`输入错误：${error}`, 'assertive');
    }
  };

  return (
    <div className="space-y-1">
      <label 
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && showRequiredIndicator && (
          <span 
            className="text-red-500 ml-1" 
            aria-label="必填项"
          >
            *
          </span>
        )}
      </label>
      
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={`${error ? errorId : ''} ${helpText ? helpId : ''}`.trim()}
        onInvalid={handleInvalid}
        className={`
          block w-full px-3 py-2 border rounded-lg shadow-sm
          focus:outline-none focus:ring-2 focus:ring-jci-blue focus:border-transparent
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          ${error 
            ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500' 
            : 'border-slate-300 text-slate-900 placeholder-slate-400'
          }
          ${className}
        `}
        {...props}
      />
      
      {error && (
        <div 
          id={errorId}
          className="flex items-center text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      
      {helpText && !error && (
        <p 
          id={helpId}
          className="text-sm text-slate-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
};

/**
 * 无障碍密码输入组件
 * Accessible Password Input Component
 */
export interface AccessiblePasswordInputProps extends Omit<AccessibleInputProps, 'type'> {
  showToggle?: boolean;
  strengthIndicator?: boolean;
}

export const AccessiblePasswordInput: React.FC<AccessiblePasswordInputProps> = ({
  showToggle = true,
  strengthIndicator = false,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);
  const { announce } = useAriaAnnouncements();

  const calculateStrength = (password: string): number => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    if (strengthIndicator) {
      const newStrength = calculateStrength(password);
      setStrength(newStrength);
    }
    props.onChange?.(e);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
    announce(showPassword ? '密码已隐藏' : '密码已显示', 'polite');
  };

  const strengthLabels = ['很弱', '弱', '一般', '强', '很强'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

  return (
    <div className="space-y-2">
      <div className="relative">
        <AccessibleInput
          {...props}
          type={showPassword ? 'text' : 'password'}
          onChange={handlePasswordChange}
          className={`${props.className || ''} ${showToggle ? 'pr-10' : ''}`}
        />
        
        {showToggle && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="
              absolute right-2 top-1/2 transform -translate-y-1/2 p-1
              text-slate-400 hover:text-slate-600 rounded
              focus:outline-none focus:ring-2 focus:ring-jci-blue focus:ring-offset-2
            "
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      
      {strengthIndicator && props.value && (
        <div className="space-y-1">
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`
                  h-2 flex-1 rounded-full
                  ${strength >= level ? strengthColors[strength - 1] : 'bg-slate-200'}
                `}
                aria-hidden="true"
              />
            ))}
          </div>
          <p 
            className="text-sm text-slate-600"
            aria-live="polite"
          >
            密码强度: {strength > 0 ? strengthLabels[strength - 1] : '无'}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * 无障碍选择框组件
 * Accessible Select Component
 */
export interface AccessibleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helpText?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const AccessibleSelect: React.FC<AccessibleSelectProps> = ({
  label,
  error,
  helpText,
  options,
  placeholder,
  required = false,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helpId = `${selectId}-help`;

  return (
    <div className="space-y-1">
      <label 
        htmlFor={selectId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span 
            className="text-red-500 ml-1" 
            aria-label="必填项"
          >
            *
          </span>
        )}
      </label>
      
      <select
        id={selectId}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={`${error ? errorId : ''} ${helpText ? helpId : ''}`.trim()}
        className={`
          block w-full px-3 py-2 border rounded-lg shadow-sm
          focus:outline-none focus:ring-2 focus:ring-jci-blue focus:border-transparent
          disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
          ${error 
            ? 'border-red-300 text-red-900 focus:ring-red-500' 
            : 'border-slate-300 text-slate-900'
          }
          ${className}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <div 
          id={errorId}
          className="flex items-center text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
      
      {helpText && !error && (
        <p 
          id={helpId}
          className="text-sm text-slate-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
};

/**
 * 无障碍复选框组件
 * Accessible Checkbox Component
 */
export interface AccessibleCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export const AccessibleCheckbox: React.FC<AccessibleCheckboxProps> = ({
  label,
  description,
  error,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const checkboxId = id || generatedId;
  const errorId = `${checkboxId}-error`;
  const descId = `${checkboxId}-desc`;

  return (
    <div className="space-y-1">
      <div className="flex items-start">
        <input
          id={checkboxId}
          type="checkbox"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={`${error ? errorId : ''} ${description ? descId : ''}`.trim()}
          className={`
            mt-1 h-4 w-4 text-jci-blue border-slate-300 rounded
            focus:ring-2 focus:ring-jci-blue focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-300' : ''}
            ${className}
          `}
          {...props}
        />
        <div className="ml-3">
          <label 
            htmlFor={checkboxId}
            className="text-sm font-medium text-slate-700 cursor-pointer"
          >
            {label}
          </label>
          {description && (
            <p 
              id={descId}
              className="text-sm text-slate-500"
            >
              {description}
            </p>
          )}
        </div>
      </div>
      
      {error && (
        <div 
          id={errorId}
          className="flex items-center text-sm text-red-600 ml-7"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * 无障碍表单组件
 * Accessible Form Component
 */
export interface AccessibleFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const AccessibleForm: React.FC<AccessibleFormProps> = ({
  title,
  description,
  children,
  className = '',
  ...props
}) => {
  const formId = useId();
  const titleId = `${formId}-title`;
  const descId = `${formId}-desc`;

  return (
    <form
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className={`space-y-4 ${className}`}
      {...props}
    >
      {title && (
        <h2 
          id={titleId}
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
      )}
      
      {description && (
        <p 
          id={descId}
          className="text-sm text-slate-600"
        >
          {description}
        </p>
      )}
      
      {children}
    </form>
  );
};

export default {
  AccessibleInput,
  AccessiblePasswordInput,
  AccessibleSelect,
  AccessibleCheckbox,
  AccessibleForm
};