import React, { useState, useEffect, useRef } from "react";

export interface MoneyInputProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  onEnterPress?: () => void;
  hasError?: boolean;
  className?: string;
  autoFocus?: boolean;
  name?: string;
  id?: string;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onChange,
      disabled = false,
      min = 0,
      max,
      placeholder = "0.00",
      onEnterPress,
      hasError = false,
      className = "",
      autoFocus = false,
      name,
      id,
    },
    ref
  ) => {
    // Internal string state for fluid typing
    const [displayVal, setDisplayVal] = useState<string>(
      value > 0 ? value.toFixed(2) : ""
    );
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (!isFocused) {
        setDisplayVal(value > 0 ? value.toFixed(2) : "");
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      // Allow only one decimal point
      const parts = raw.split(".");
      const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;

      setDisplayVal(clean);
      const parsed = parseFloat(clean);
      onChange(isNaN(parsed) || parsed < 0 ? 0 : parsed);
    };

    const handleBlur = () => {
      setIsFocused(false);
      const parsed = parseFloat(displayVal.replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        setDisplayVal(parsed.toFixed(2));
        onChange(parsed);
      } else {
        setDisplayVal("");
        onChange(0);
      }
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onEnterPress?.();
      }
    };

    return (
      <div
        className={`relative inline-flex items-center w-full max-w-[200px] rounded-xl border bg-white transition-all shadow-sm ${
          hasError
            ? "border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
            : "border-slate-300 hover:border-slate-400 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100"
        } ${disabled ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""} ${className}`}
      >
        <span className="pl-3.5 pr-1 text-sm font-semibold text-slate-500 select-none">
          ₱
        </span>
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={displayVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={hasError}
          className="w-full h-11 pr-3.5 text-right font-mono font-semibold text-sm text-slate-900 bg-transparent outline-none disabled:cursor-not-allowed placeholder:text-slate-300"
        />
      </div>
    );
  }
);

MoneyInput.displayName = "MoneyInput";

