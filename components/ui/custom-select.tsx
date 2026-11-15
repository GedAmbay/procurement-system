"use client";

import React, { useState, useRef, useEffect, useId } from "react";
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
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Auto-enable search if there are more than 7 options unless explicitly specified
  const isSearchable = searchable ?? options.length > 7;

  // Selected option label
  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && isSearchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  const filteredOptions = isSearchable && searchQuery.trim()
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

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
    >
      {/* Hidden input for form data if name provided */}
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {/* Button Trigger */}
      <button
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
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-left text-sm transition-all outline-none select-none ${
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200"
            : isOpen
            ? "bg-white text-slate-900 ring-2 ring-blue-500/40 border border-blue-400 shadow-sm"
            : "bg-[#e8edf4] hover:bg-[#dfe5ee] text-slate-800 shadow-[inset_3px_3px_6px_#c3ccdb,inset_-3px_-3px_6px_#fbfdff] border border-transparent focus-visible:ring-2 focus-visible:ring-blue-500/40"
        }`}
      >
        <div className="flex-1 min-w-0">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-800 truncate">{selectedOption.label}</span>
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
          size={16}
          className={`shrink-0 text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Options */}
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={selectId}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ minWidth: "100%" }}
        >
          {/* Search Box if searchable */}
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

          {/* Options List */}
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
                    {isSelected && (
                      <Check size={16} className="text-blue-600 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
