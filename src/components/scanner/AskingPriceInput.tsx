// FILE: src/components/scanner/AskingPriceInput.tsx
// Mobile-first asking price input for scanner flow
// v7.5 - Enables accurate BUY/SELL decisions by capturing seller's asking price
//
// PROBLEM SOLVED:
// Previously, AI voted BUY/SELL without knowing what the seller was asking.
// Now users can optionally enter the asking price for accurate profit calculation.
//
// USAGE:
// <AskingPriceInput 
//   value={askingPrice}
//   onChange={setAskingPrice}
//   estimatedValue={hydraEstimate}  // Optional: shows profit margin
// />

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, HelpCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AskingPriceInputProps {
  /** Current asking price value */
  value: number | null;
  /** Callback when price changes */
  onChange: (price: number | null) => void;
  /** HYDRA's estimated market value (shows profit margin if provided) */
  estimatedValue?: number | null;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Compact mode for inline usage */
  compact?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export const AskingPriceInput: React.FC<AskingPriceInputProps> = ({
  value,
  onChange,
  estimatedValue,
  placeholder = 'Shelf price',
  className,
  disabled = false,
  compact = false,
  autoFocus = false,
}) => {
  const [inputValue, setInputValue] = useState(value?.toString() || '');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (value !== null && value !== parseFloat(inputValue)) {
      setInputValue(value.toString());
    }
  }, [value]);

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    
    // Allow empty input
    if (raw === '') {
      setInputValue('');
      onChange(null);
      return;
    }
    
    // Only allow valid number input (with decimal)
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
    
    setInputValue(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleClear = () => {
    setInputValue('');
    onChange(null);
    inputRef.current?.focus();
  };

  // Calculate profit margin if we have both values
  const profitMargin = value && estimatedValue 
    ? estimatedValue - value 
    : null;
  const profitPercent = value && estimatedValue && value > 0
    ? ((estimatedValue - value) / value * 100)
    : null;
  const isProfit = profitMargin !== null && profitMargin > 0;
  const isLoss = profitMargin !== null && profitMargin < 0;

  // Determine BUY/SELL recommendation
  const recommendation = profitMargin !== null
    ? profitMargin > 0 ? 'BUY' : 'SELL'
    : null;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative flex-1">
          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-7 pr-8 h-9 bg-background/50"
          />
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {profitMargin !== null && (
          <span className={cn(
            'text-sm font-semibold whitespace-nowrap',
            isProfit && 'text-green-500',
            isLoss && 'text-red-500'
          )}>
            {isProfit ? '+' : ''}{profitMargin.toFixed(2)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Asking Price
          <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </label>
        {recommendation && (
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded',
            recommendation === 'BUY' && 'bg-green-500/20 text-green-500',
            recommendation === 'SELL' && 'bg-red-500/20 text-red-500'
          )}>
            {recommendation}
          </span>
        )}
      </div>

      {/* Input Field */}
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pl-10 pr-10 h-12 text-lg font-medium bg-background/50 transition-all',
            isFocused && 'ring-2 ring-primary/50',
            isProfit && value && 'border-green-500/50',
            isLoss && value && 'border-red-500/50'
          )}
        />
        {inputValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Profit Margin Display */}
      {profitMargin !== null && estimatedValue && (
        <div className={cn(
          'flex items-center justify-between p-3 rounded-lg transition-all',
          isProfit && 'bg-green-500/10 border border-green-500/20',
          isLoss && 'bg-red-500/10 border border-red-500/20',
          !isProfit && !isLoss && 'bg-muted/50'
        )}>
          <div className="flex items-center gap-2">
            {isProfit ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : isLoss ? (
              <TrendingDown className="h-5 w-5 text-red-500" />
            ) : (
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-xs text-muted-foreground">Potential Profit</p>
              <p className={cn(
                'font-bold',
                isProfit && 'text-green-500',
                isLoss && 'text-red-500'
              )}>
                {isProfit ? '+' : ''}${profitMargin.toFixed(2)}
                {profitPercent !== null && (
                  <span className="text-xs font-normal ml-1">
                    ({isProfit ? '+' : ''}{profitPercent.toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Market Value</p>
            <p className="font-semibold">${estimatedValue.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!value && !isFocused && (
        <p className="text-xs text-muted-foreground">
          Enter the seller's asking price for accurate BUY/SELL analysis
        </p>
      )}
    </div>
  );
};

export default AskingPriceInput;