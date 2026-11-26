"use client";

import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  searchable?: boolean;
  floatingLabel?: string;
  required?: boolean;
  hasError?: boolean;
  size?: "default" | "sm";
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  disabled = false,
  className = "",
  id,
  name,
  searchable,
  floatingLabel,
  required = false,
  hasError = false,
  size = "default",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  const isSearchable = searchable ?? options.length > 7;
  const selectedOption = options.find((opt) => opt.value === value);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 240 && rect.top > spaceBelow;

    if (openUpward) {
      setMenuPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.left,
        width: Math.max(rect.width, 120),
      });
    } else {
      setMenuPos({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 120),
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (isOpen && isSearchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  const filteredOptions =
    isSearchable && searchQuery.trim()
      ? options.filter((opt) => {
          const query = searchQuery.toLowerCase();
          return (
            opt.label.toLowerCase().includes(query) ||
            (opt.sublabel && opt.sublabel.toLowerCase().includes(query))
          );
        })
      : options;

  const handleSelect = (val: string) => {
    onChange?.(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  const isFloating = isOpen || Boolean(selectedOption);

  const dropdownMenu =
    isOpen && menuPos ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-labelledby={selectId}
        style={{
          position: "fixed",
          top: menuPos.top,
          bottom: menuPos.bottom,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 200,
        }}
        className="bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/15 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {isSearchable && (
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search options..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-1.5 max-h-60 overflow-y-auto scrollbar-thin">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">
              No matching options found
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                    opt.disabled
                      ? "opacity-40 cursor-not-allowed"
                      : isSelected
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                      : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-slate-500 font-normal truncate">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={16} className="text-blue-600 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {floatingLabel ? (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            id={selectId}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setIsOpen((prev) => !prev);
                setSearchQuery("");
              }
            }}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            style={{
              width: "100%",
              height: "54px",
              padding: "1.25rem 0.875rem 0.4rem",
              border: hasError
                ? "2px solid #ef4444"
                : isOpen
                ? "2px solid #0f172a"
                : "2px solid transparent",
              borderRadius: "0.625rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              color: "#0f172a",
              background: isOpen ? "#ffffff" : "#ECF0F3",
              outline: "none",
              boxSizing: "border-box",
              boxShadow: isOpen
                ? "none"
                : "inset 18px 18px 30px #D1D9E6, inset -18px -18px 30px #ffffff",
              transition: "all 0.16s ease-in-out",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              textAlign: "left",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            <span className="flex-1 min-w-0 truncate">
              {selectedOption ? (
                selectedOption.label
              ) : isOpen ? (
                <span className="text-slate-400 font-normal">{placeholder}</span>
              ) : (
                ""
              )}
            </span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-slate-500 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-slate-900" : ""
              }`}
            />
          </button>
          <label
            htmlFor={selectId}
            style={{
              position: "absolute",
              left: "0.875rem",
              top: isFloating ? "0.45rem" : "50%",
              transform: isFloating ? "translateY(0)" : "translateY(-50%)",
              fontSize: isFloating ? "0.625rem" : "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: hasError ? "#ef4444" : isOpen ? "#0f172a" : "#64748b",
              pointerEvents: "none",
              transition: "all 0.16s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {floatingLabel} {required && <span style={{ color: "#ef4444" }}>*</span>}
          </label>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          id={selectId}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              setSearchQuery("");
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full flex items-center justify-between gap-2 text-left transition-all outline-none select-none cursor-pointer ${
            size === "sm"
              ? "h-8 px-2.5 rounded-lg text-xs"
              : "px-3.5 py-2.5 rounded-xl text-sm"
          } ${
            disabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200"
              : isOpen
              ? "bg-white text-slate-900 ring-2 ring-blue-500/40 border border-blue-400 shadow-sm"
              : size === "sm"
              ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
              : "bg-[#e8edf4] hover:bg-[#dfe5ee] text-slate-800 shadow-[inset_3px_3px_6px_#c3ccdb,inset_-3px_-3px_6px_#fbfdff] border border-transparent focus-visible:ring-2 focus-visible:ring-blue-500/40"
          }`}
        >
          <div className="flex-1 min-w-0">
            {selectedOption ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className={`${size === "sm" ? "font-medium" : "font-semibold"} text-slate-800 truncate`}>
                  {selectedOption.label}
                </span>
                {selectedOption.sublabel && (
                  <span className="text-xs text-slate-500 truncate font-normal">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 font-normal">{placeholder}</span>
            )}
          </div>

          <ChevronDown
            size={size === "sm" ? 14 : 16}
            className={`shrink-0 text-slate-500 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </button>
      )}

      {dropdownMenu &&
        (typeof document !== "undefined" ? createPortal(dropdownMenu, document.body) : dropdownMenu)}
    </div>
  );
}
