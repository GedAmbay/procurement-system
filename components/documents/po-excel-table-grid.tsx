"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { formatCurrency, numberToWords } from "@/lib/utils";
import { FormattedCellText } from "@/components/ui/formatted-cell-text";
import { toggleCellFormat, applyInlineFormat, FormatType } from "@/lib/format-text-helpers";

export interface PoLineItem {
  id?: string;
  description: string;
  quantity: number | "";
  unit: string;
  unitPrice: number | "";
  totalPrice?: number;
  propertyNo?: string;
  descriptionEdited?: boolean;
}

interface PoExcelTableGridProps {
  items: PoLineItem[];
  targetRows?: number;
  isReadOnly?: boolean;
  requestingOffice?: string;
  totalAmount?: number;
  winningQuote?: any;
  onChange: (newItems: PoLineItem[]) => void;
  onRowSelect?: (index: number) => void;
  onStartInsert?: (index: number) => void;
  activeItemIndex?: number | null;
  onDeselect?: () => void;
}

// Columns: 0 = PropertyNo, 1 = Unit, 2 = Description, 3 = Quantity, 4 = UnitPrice
type EditableCol = 0 | 1 | 2 | 3 | 4;

export function PoExcelTableGrid({
  items,
  targetRows = 10,
  isReadOnly = false,
  requestingOffice = "",
  totalAmount = 0,
  winningQuote,
  onChange,
  onRowSelect,
  onStartInsert,
  activeItemIndex = null,
  onDeselect,
}: PoExcelTableGridProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: EditableCol } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const initialValueOnEditRef = useRef<string>("");

  const safeItems = items || [];
  const itemsRef = useRef<PoLineItem[]>(safeItems);
  useEffect(() => {
    itemsRef.current = items || [];
  }, [items]);

  // Helper to resolve unit cost from winning quote if 0 on item
  const getUnitCost = useCallback((item: PoLineItem): number => {
    if (item.unitPrice !== "" && Number(item.unitPrice) > 0) {
      return Number(item.unitPrice);
    }
    if (winningQuote?.lineItems) {
      const qLine = winningQuote.lineItems.find(
        (qli: any) =>
          qli.rfqLineItemId === item.id ||
          qli.rfqLineItem?.description?.trim().toLowerCase() === item.description?.trim().toLowerCase()
      );
      if (qLine?.unitPrice && Number(qLine.unitPrice) > 0) {
        return Number(qLine.unitPrice);
      }
    }
    return 0;
  }, [winningQuote]);

  // Get raw string value of a cell
  const getCellValue = useCallback((row: number, col: EditableCol): string => {
    const list = itemsRef.current || [];
    const item = list[row];
    if (!item) return "";
    switch (col) {
      case 0: // Property / Stock No
        return item.propertyNo || "";
      case 1: // Unit
        return item.unit || "";
      case 2: // Description
        return item.description || "";
      case 3: // Quantity
        return item.quantity === "" || item.quantity === null || item.quantity === undefined
          ? ""
          : String(item.quantity);
      case 4: // Unit Cost
        return item.unitPrice === "" || item.unitPrice === null || item.unitPrice === undefined
          ? ""
          : String(item.unitPrice);
      default:
        return "";
    }
  }, []);

  // Commit value change for a cell
  const commitCellValue = useCallback((row: number, col: EditableCol, rawVal: string) => {
    if (isReadOnly) return;
    const trimmed = rawVal.trim();
    const currentList = itemsRef.current || [];

    if (trimmed === "" && row >= currentList.length) {
      return;
    }

    const newItems = [...currentList];
    while (newItems.length <= row) {
      newItems.push({
        description: "",
        unit: "Unit",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      });
    }

    const current = { ...newItems[row] };
    switch (col) {
      case 0: { // Property / Stock No
        current.propertyNo = rawVal;
        break;
      }
      case 1: { // Unit
        current.unit = rawVal;
        break;
      }
      case 2: { // Description
        current.description = rawVal;
        current.descriptionEdited = true;
        break;
      }
      case 3: { // Quantity
        const qty = trimmed === "" ? "" : isNaN(Number(trimmed)) ? 0 : Number(trimmed);
        current.quantity = qty;
        const price = typeof current.unitPrice === "number" ? current.unitPrice : 0;
        current.totalPrice = typeof qty === "number" ? qty * price : 0;
        break;
      }
      case 4: { // Unit Cost
        const price = trimmed === "" ? "" : isNaN(Number(trimmed)) ? 0 : Number(trimmed);
        current.unitPrice = price;
        const qty = typeof current.quantity === "number" ? current.quantity : 0;
        current.totalPrice = typeof price === "number" ? qty * price : 0;
        break;
      }
    }

    newItems[row] = current;
    itemsRef.current = newItems;
    onChange(newItems);
  }, [isReadOnly, onChange]);

  // Enter edit mode without overwriting existing content (appends typed character if provided)
  const startEditing = useCallback((row: number, col: EditableCol, initialChar?: string) => {
    if (isReadOnly) return;
    const val = getCellValue(row, col);
    initialValueOnEditRef.current = val;
    const nextVal = initialChar !== undefined ? val + initialChar : val;
    setEditValue(nextVal);
    setIsEditing(true);
  }, [isReadOnly, getCellValue]);

  // Focus active input when editing starts
  useEffect(() => {
    if (isEditing && activeInputRef.current) {
      activeInputRef.current.focus();
      const len = activeInputRef.current.value.length;
      activeInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Keep selection container focused when in selection mode
  useEffect(() => {
    if (!isEditing && selectedCell && gridContainerRef.current) {
      gridContainerRef.current.focus({ preventScroll: true });
    }
  }, [selectedCell, isEditing]);

  // Synchronize cell highlight when active row changes from outside (e.g. Next/Prev buttons in side panel)
  useEffect(() => {
    if (activeItemIndex !== null && activeItemIndex !== undefined) {
      setSelectedCell((prev) => {
        const col = prev?.row === activeItemIndex ? prev.col : (prev?.col ?? 2);
        return { row: activeItemIndex, col };
      });
      setIsEditing(false);
    } else {
      setSelectedCell(null);
      setIsEditing(false);
    }
  }, [activeItemIndex]);

  // Handle cell selection click
  const handleCellClick = (row: number, col: EditableCol) => {
    if (isReadOnly) return;

    if (isEditing && selectedCell) {
      commitCellValue(selectedCell.row, selectedCell.col, editValue);
      setIsEditing(false);
    }

    setSelectedCell({ row, col });
    setIsEditing(false);

    if (onRowSelect) {
      onRowSelect(row);
    }
  };

  // Handle double click -> enter edit mode
  const handleCellDoubleClick = (row: number, col: EditableCol) => {
    if (isReadOnly) return;
    setSelectedCell({ row, col });
    startEditing(row, col);
  };

  // Navigation helper
  const navigateTo = useCallback((targetRow: number, targetCol: EditableCol, keepEditMode = false) => {
    let nextRow = targetRow;
    let nextCol = targetCol;

    // Wrap column boundaries (cols 0, 1, 2, 3, 4)
    if (nextCol > 4) {
      nextCol = 0;
      nextRow += 1;
    } else if (nextCol < 0) {
      nextCol = 4;
      nextRow -= 1;
    }

    // Clamp row lower bound
    if (nextRow < 0) {
      nextRow = 0;
    }

    const maxRows = Math.max(targetRows, itemsRef.current?.length || 0);
    if (nextRow >= maxRows) {
      nextRow = maxRows - 1;
    }

    setSelectedCell({ row: nextRow, col: nextCol });
    if (onRowSelect) {
      onRowSelect(nextRow);
    }

    if (keepEditMode) {
      startEditing(nextRow, nextCol);
    } else {
      setIsEditing(false);
    }
  }, [targetRows, onRowSelect, startEditing]);

  // Keyboard navigation when in SELECTION MODE (container has focus)
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isReadOnly || !selectedCell || isEditing) return;

    const { row, col } = selectedCell;

    // Excel mode: Ctrl+B (bold) or Ctrl+I (italic) formatting on selected cell
    if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B" || e.key === "i" || e.key === "I")) {
      e.preventDefault();
      const format: FormatType = (e.key === "b" || e.key === "B") ? "bold" : "italic";
      const currentVal = getCellValue(row, col);
      if (currentVal) {
        const nextVal = toggleCellFormat(currentVal, format);
        commitCellValue(row, col, nextVal);
      }
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        navigateTo(row - 1, col);
        break;
      case "ArrowDown":
        e.preventDefault();
        navigateTo(row + 1, col);
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateTo(row, (col - 1) as EditableCol);
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateTo(row, (col + 1) as EditableCol);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          navigateTo(row, (col - 1) as EditableCol);
        } else {
          navigateTo(row, (col + 1) as EditableCol);
        }
        break;
      case "Enter":
      case "F2":
        e.preventDefault();
        startEditing(row, col);
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        commitCellValue(row, col, "");
        break;
      case "Escape":
        e.preventDefault();
        setSelectedCell(null);
        setIsEditing(false);
        if (onDeselect) onDeselect();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          startEditing(row, col, e.key);
        }
        break;
    }
  };

  // Keyboard navigation when in EDIT MODE (input has focus)
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;

    // Word mode: Ctrl+B (bold) or Ctrl+I (italic) inline formatting on highlighted text
    if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B" || e.key === "i" || e.key === "I")) {
      e.preventDefault();
      const format: FormatType = (e.key === "b" || e.key === "B") ? "bold" : "italic";
      const target = e.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const { newText, newStart, newEnd } = applyInlineFormat(editValue, start, end, format);
      setEditValue(newText);
      requestAnimationFrame(() => {
        if (activeInputRef.current) {
          activeInputRef.current.setSelectionRange(newStart, newEnd);
          if (activeInputRef.current.tagName.toLowerCase() === "textarea") {
            activeInputRef.current.style.height = "auto";
            activeInputRef.current.style.height = `${Math.max(20, activeInputRef.current.scrollHeight)}px`;
          }
        }
      });
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      navigateTo(row + 1, col, false);
    } else if (e.key === "Enter" && e.shiftKey) {
      if (col !== 2) {
        e.preventDefault();
        commitCellValue(row, col, editValue);
        navigateTo(row - 1, col, false);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      if (e.shiftKey) {
        navigateTo(row, (col - 1) as EditableCol, false);
      } else {
        navigateTo(row, (col + 1) as EditableCol, false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(initialValueOnEditRef.current);
      setIsEditing(false);
    } else if (col !== 2 && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      commitCellValue(row, col, editValue);
      navigateTo(e.key === "ArrowUp" ? row - 1 : row + 1, col, false);
    }
  };

  const handleInputBlur = () => {
    if (selectedCell && isEditing) {
      commitCellValue(selectedCell.row, selectedCell.col, editValue);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={gridContainerRef}
      tabIndex={isReadOnly ? -1 : 0}
      onKeyDown={handleContainerKeyDown}
      className="outline-none focus:outline-none select-none"
    >
      <table className="w-full border-collapse border-t-[2px] border-black table-fixed text-[14px]">
        <colgroup>
          <col style={{ width: "10%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "44%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead className="print:!table-row-group">
          <tr className="border-b-[2px] border-black text-[14px]">
            <th className="border-r border-black p-1 text-center font-bold">
              Stock/<br />Property No.
            </th>
            <th className="border-r border-black p-1 text-center font-bold">
              Unit
            </th>
            <th className="border-r border-black p-1 text-center font-bold">
              Description
            </th>
            <th className="border-r border-black p-1 text-center font-bold">
              Quantity
            </th>
            <th className="border-r border-black p-1 text-center font-bold">
              Unit Cost
            </th>
            <th className="p-1 text-center font-bold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {safeItems.map((item, idx) => {
            const isEmptyRow =
              !item.description?.trim() &&
              (!item.quantity || Number(item.quantity) === 0) &&
              !item.unit?.trim();

            const isSpec = !isEmptyRow && (!item.quantity || Number(item.quantity) === 0);

            let displayNo = "";
            if (!isSpec && !isEmptyRow) {
              let count = 0;
              for (let i = 0; i <= idx; i++) {
                if (Number(safeItems[i].quantity) > 0) count++;
              }
              displayNo = count.toString();
            }

            const hasSpecs =
              !isSpec &&
              idx + 1 < safeItems.length &&
              safeItems[idx + 1].description?.trim() &&
              (!safeItems[idx + 1].quantity || Number(safeItems[idx + 1].quantity) === 0);

            const isRowSelected = selectedCell?.row === idx || activeItemIndex === idx;

            const unitCost = getUnitCost(item);
            const lineAmount =
              item.totalPrice && item.totalPrice > 0
                ? item.totalPrice
                : (typeof item.quantity === "number" && item.quantity > 0 ? item.quantity * unitCost : 0);

            return (
              <tr
                key={idx}
                className={`group/row transition-colors ${
                  !isReadOnly && isRowSelected && selectedCell === null ? "bg-blue-50/70" : ""
                }`}
              >
                {/* Col 0 (Editable Col 0): Property / Stock No */}
                <td
                  onClick={() => handleCellClick(idx, 0)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 0)}
                  className={`border-r border-black p-0 text-center align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 0
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  {!isReadOnly && onStartInsert && (
                    <div className="absolute top-1/2 left-[-26px] -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity no-print z-30 flex items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartInsert(idx + 1);
                        }}
                        className="w-5 h-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110"
                        title={`Insert row below ${isSpec ? "specification" : `Item #${displayNo || idx + 1}`}`}
                      >
                        <Plus size={12} className="stroke-[3]" />
                      </button>
                    </div>
                  )}

                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 0 ? (
                    <input
                      ref={(el) => { activeInputRef.current = el; }}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px]"
                    />
                  ) : (
                    <span>{item.propertyNo || (isSpec ? "" : displayNo)}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 0 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 1 (Editable Col 1): Unit */}
                <td
                  onClick={() => handleCellClick(idx, 1)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 1)}
                  className={`border-r border-black p-0 text-center align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 1
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 1 ? (
                    <input
                      ref={(el) => { activeInputRef.current = el; }}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px]"
                    />
                  ) : (
                    <span>{isSpec ? "" : item.unit}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 1 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 2 (Editable Col 2): Description */}
                <td
                  onClick={() => handleCellClick(idx, 2)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 2)}
                  className={`border-r border-black p-0 px-1.5 align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${isSpec ? "pl-4" : hasSpecs ? "font-bold" : ""} ${
                    selectedCell?.row === idx && selectedCell?.col === 2
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 2 ? (
                    <textarea
                      ref={(el) => { activeInputRef.current = el; }}
                      rows={1}
                      value={editValue}
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.max(20, e.target.scrollHeight)}px`;
                      }}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full resize-none overflow-hidden bg-white border-0 outline-none p-0 m-0 leading-tight text-left block font-['Times_New_Roman',_Times,_serif] text-[14px]"
                      style={{ minHeight: "1.25rem", fontSize: "14px" }}
                    />
                  ) : (
                    <FormattedCellText text={item.description} fallback="\u00A0" />
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 2 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 3 (Editable Col 3): Quantity */}
                <td
                  onClick={() => handleCellClick(idx, 3)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 3)}
                  className={`border-r border-black p-0 text-center align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 3
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 3 ? (
                    <input
                      ref={(el) => { activeInputRef.current = el; }}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full h-full text-center bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px]"
                    />
                  ) : (
                    <span>{isSpec ? "" : item.quantity}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 3 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 4 (Editable Col 4): Unit Cost */}
                <td
                  onClick={() => handleCellClick(idx, 4)}
                  onDoubleClick={() => handleCellDoubleClick(idx, 4)}
                  className={`border-r border-black p-0 px-2 text-right align-top leading-normal relative ${
                    !isReadOnly ? "cursor-cell" : ""
                  } ${
                    selectedCell?.row === idx && selectedCell?.col === 4
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  {isEditing && selectedCell?.row === idx && selectedCell?.col === 4 ? (
                    <input
                      ref={(el) => { activeInputRef.current = el; }}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className="w-full h-full text-right bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px]"
                    />
                  ) : (
                    <span>{isSpec ? "" : unitCost > 0 ? unitCost.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</span>
                  )}

                  {selectedCell?.row === idx && selectedCell?.col === 4 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 5 (Computed): Amount */}
                <td className="p-0 px-2 text-right align-top leading-normal">
                  {isSpec ? "" : lineAmount > 0 ? formatCurrency(lineAmount).replace("₱", "") : ""}
                </td>
              </tr>
            );
          })}

          {/* Empty rows filler */}
          {Array.from({ length: Math.max(0, targetRows - safeItems.length) }).map((_, i) => {
            const emptyRowIdx = safeItems.length + i;
            return (
              <tr key={`empty-${i}`} className="h-6">
                {[0, 1, 2, 3, 4].map((col) => {
                  const isSelected = selectedCell?.row === emptyRowIdx && selectedCell?.col === col;
                  const isEditingThis = isEditing && isSelected;
                  return (
                    <td
                      key={col}
                      onClick={() => handleCellClick(emptyRowIdx, col as EditableCol)}
                      onDoubleClick={() => handleCellDoubleClick(emptyRowIdx, col as EditableCol)}
                      className={`border-r border-black p-0 leading-tight align-top relative ${
                        col === 2 ? "text-left px-1.5" : col === 4 ? "text-right px-2" : "text-center"
                      } ${!isReadOnly ? "cursor-cell" : ""} ${
                        isSelected ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20" : ""
                      }`}
                    >
                      {isEditingThis ? (
                        col === 2 ? (
                          <textarea
                            ref={(el) => { activeInputRef.current = el; }}
                            rows={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            className="w-full resize-none overflow-hidden bg-white border-0 outline-none p-0 m-0 leading-tight text-left block font-['Times_New_Roman',_Times,_serif] text-[14px]"
                            style={{ minHeight: "1.25rem", fontSize: "14px" }}
                          />
                        ) : (
                          <input
                            ref={(el) => { activeInputRef.current = el; }}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            className={`w-full h-full bg-white border-0 outline-none p-0 m-0 leading-tight font-['Times_New_Roman',_Times,_serif] text-[14px] ${
                              col === 4 ? "text-right" : "text-center"
                            }`}
                          />
                        )
                      ) : null}

                      {isSelected && !isEditing && (
                        <div
                          className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                          style={{ border: "1px solid #ffffff" }}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="p-1"></td>
              </tr>
            );
          })}

          {/* Footer requesting office placeholder row */}
          <tr>
            <td className="border-r border-black"></td>
            <td className="border-r border-black"></td>
            <td className="border-r border-black text-center font-bold italic py-4">
              {requestingOffice || "Municipal Civil Registrar"}
            </td>
            <td className="border-r border-black"></td>
            <td className="border-r border-black"></td>
            <td></td>
          </tr>

          <tr>
            <td colSpan={6} className="p-0 border-0">
              <div className="border-t-[2px] border-black w-full"></div>
            </td>
          </tr>
          <tr className="font-bold">
            <td colSpan={2} className="p-1 px-1 text-left text-[11px] leading-tight tracking-tight">
              (Total Amount in Words)
            </td>
            <td colSpan={3} className="p-1 px-4 font-normal break-words">
              {totalAmount > 0 ? numberToWords(totalAmount) : ""}
            </td>
            <td className="p-1 text-right">
              {totalAmount > 0 ? formatCurrency(totalAmount).replace("₱", "") : ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
