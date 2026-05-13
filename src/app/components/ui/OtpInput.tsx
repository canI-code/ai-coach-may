'use client';

import React, { useRef, useEffect } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: 4 | 6;
  error?: boolean;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, length = 4, error = false, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return; // Only allow digits

    const maxLen = length;
    const newValue = digit.slice(0, maxLen);
    
    const newOtp = value.split('');
    newOtp[index] = newValue;
    onChange(newOtp.join('').slice(0, maxLen));

    // Auto-focus next input if value entered
    if (newValue && index < maxLen - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      // If current box is empty, move to previous
      if (!value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, length);
    
    if (digits) {
      onChange(digits);
      // Focus the last filled input or the first empty one
      const focusIndex = Math.min(digits.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const digits = value.split('').slice(0, length);
  const maxLen = length;

  return (
    <div className="flex justify-center gap-2 md:gap-3" onPaste={handlePaste}>
      {Array.from({ length: maxLen }, (_, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[index] || ''}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => {
            // Select all text on focus for easy replacement
            e.currentTarget.select();
          }}
          className={`
            w-12 h-14 md:w-14 md:h-16 
            text-center text-xl md:text-2xl font-bold
            rounded-xl border-2
            transition-all duration-200
            outline-none
            ${error 
              ? 'border-red-500 bg-red-500/10 text-red-400 focus:border-red-400' 
              : 'border-white/20 bg-white/5 text-white focus:border-amber-500 focus:bg-white/10'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          style={{ fontFamily: 'monospace' }}
        />
      ))}
    </div>
  );
}