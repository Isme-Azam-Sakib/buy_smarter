'use client';

import { useState, useEffect } from 'react';

interface CustomInputProps {
  type?: 'text' | 'email' | 'tel' | 'password' | 'number' | 'url';
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  label?: string;
  id?: string;
  name?: string;
}

export function CustomInput({ 
  type = 'text', 
  placeholder, 
  value = '', 
  onChange, 
  className = '',
  inputClassName = '',
  required = false,
  label,
  id,
  name,
}: CustomInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Sync internal state with external value prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  const hasValue = inputValue.length > 0;
  const isLabelVisible = isFocused || hasValue;

  // Treat empty string as undefined to fall back to placeholder
  const displayLabel = (label && label.trim() !== '') ? label : placeholder;

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        name={name}
        type={type}
        value={inputValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        required={required}
        className={`
          w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 ease-in-out text-sm sm:text-base
          ${isFocused 
            ? 'border-2 border-gray-700 bg-white' 
            : 'border border-gray-300 bg-white'
          }
          focus:outline-none
          ${inputClassName || ''}
        `}
      />
      
      {/* Floating Label */}
      <label
        className={`
          absolute left-3 sm:left-4 transition-all duration-300 ease-in-out pointer-events-none
          ${isLabelVisible
            ? 'top-0 -translate-y-1/2 bg-white px-2 text-xs sm:text-sm text-gray-700'
            : 'top-1/2 -translate-y-1/2 text-gray-400 text-sm sm:text-base'
          }
        `}
      >
        <span>{displayLabel}</span>
        {required && <span className="ml-1 text-my-accent">*</span>}
      </label>
    </div>
  );
}
