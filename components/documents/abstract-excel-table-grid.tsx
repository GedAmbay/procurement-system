"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Minus } from "lucide-react";
import { FormattedCellText } from "@/components/ui/formatted-cell-text";

export interface AbstractLineItemData {
  id: string;
  description: string;
  quantity: number | "";
  unit: string;
}

export interface AbstractQuotationData {
  id: string;
  totalAmount: number;
  supplier?: {
    id: string;
    name: string;
  };
  lineItems?: {
    id?: string;
    rfqLineItemId: string;
    unitPrice: number;
    totalPrice: number;
  }[];
}

interface AbstractExcelTableGridProps {
  items: AbstractLineItemData[];
  quotations: (AbstractQuotationData | null)[];
  targetRows?: number;
  isReadOnly?: boolean;
  pageBreaks?: (number | string)[];
  onTogglePageBreak?: (idx: number | string) => void;
  activeItemIndex?: number | null;
  onRowSelect?: (index: number) => void;
  onPriceChange?: (quotationId: string, rfqLineItemId: string, newUnitPrice: number) => void;
  onDeselect?: () => void;
}

export function AbstractExcelTableGrid({
  items,
  quotations,
  targetRows = 15,
  isReadOnly = false,
  pageBreaks = [],
  onTogglePageBreak,
  activeItemIndex = null,
  onRowSelect,
  onPriceChange,
  onDeselect,
}: AbstractExcelTableGridProps) {
  // Selected cell: row (item index) and col:
  // 0: Description, 1: Qty, 2: Unit, 3: Supplier 0 Unit Price, 4: Supplier 1 Unit Price, 5: Supplier 2 Unit Price
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>("");

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);

  const safeItems = items || [];
  const safeQuotes = quotations || [];

  const getPrice = useCallback(
    (quote: AbstractQuotationData | null, lineItemId: string) => {
      if (!quote || !quote.lineItems) return { unitPrice: 0, totalPrice: 0 };
      const li = quote.lineItems.find((l) => l.rfqLineItemId === lineItemId);
      return li
        ? { unitPrice: li.unitPrice || 0, totalPrice: li.totalPrice || 0 }
        : { unitPrice: 0, totalPrice: 0 };
    },
    []
  );

  const fmt2 = (n: number) =>
    n > 0
      ? n.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "";

  // Synchronize cell highlight when activeItemIndex changes from side panel
  useEffect(() => {
    if (activeItemIndex !== null && activeItemIndex !== undefined) {
      setSelectedCell((prev) => {
        const col = prev?.row === activeItemIndex ? prev.col : 0;
        return { row: activeItemIndex, col };
      });
      setIsEditing(false);
    } else {
      setSelectedCell(null);
      setIsEditing(false);
    }
  }, [activeItemIndex]);

  // Keep grid container focused when in navigation mode
  useEffect(() => {
    if (!isEditing && selectedCell && gridContainerRef.current) {
      gridContainerRef.current.focus({ preventScroll: true });
    }
  }, [selectedCell, isEditing]);

  // Focus active input when editing starts
  useEffect(() => {
    if (isEditing && activeInputRef.current) {
      activeInputRef.current.focus();
      const len = activeInputRef.current.value.length;
      activeInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const startEditing = useCallback(
    (row: number, col: number, initialChar?: string) => {
      if (isReadOnly) return;
      const item = safeItems[row];
      if (!item) return;

      const isSpec = !item.quantity || Number(item.quantity) === 0;
      // Col 3, 4, 5 are supplier prices: disabled for specs or null quotes
      if (col >= 3) {
        if (isSpec) return;
        const qIndex = col - 3;
        const quote = safeQuotes[qIndex];
        if (!quote) return;
        const currentPrice = getPrice(quote, item.id).unitPrice;
        const baseVal = currentPrice > 0 ? String(currentPrice) : "";
        const nextVal = initialChar !== undefined ? initialChar : baseVal;
        setEditValue(nextVal);
        setIsEditing(true);
      }
    },
    [isReadOnly, safeItems, safeQuotes, getPrice]
  );

  const commitPriceChange = useCallback(
    (row: number, col: number, rawVal: string) => {
      if (col < 3) return;
      const item = safeItems[row];
      if (!item) return;
      const qIndex = col - 3;
      const quote = safeQuotes[qIndex];
      if (!quote || !onPriceChange) return;

      const trimmed = rawVal.trim();
      const parsed = trimmed === "" ? 0 : parseFloat(trimmed);
      const cleanPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      onPriceChange(quote.id, item.id, cleanPrice);
    },
    [safeItems, safeQuotes, onPriceChange]
  );

  const handleCellClick = (row: number, col: number) => {
    if (selectedCell?.row === row && selectedCell?.col === col) {
      startEditing(row, col);
    } else {
      if (isEditing && selectedCell) {
        commitPriceChange(selectedCell.row, selectedCell.col, editValue);
      }
      setIsEditing(false);
      setSelectedCell({ row, col });
      if (onRowSelect) onRowSelect(row);
    }
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    startEditing(row, col);
  };

  const navigateTo = (newRow: number, newCol: number) => {
    if (isEditing && selectedCell) {
      commitPriceChange(selectedCell.row, selectedCell.col, editValue);
    }
    setIsEditing(false);

    const maxRow = safeItems.length - 1;
    if (maxRow < 0) return;
    const clampedRow = Math.max(0, Math.min(newRow, maxRow));
    const clampedCol = Math.max(0, Math.min(newCol, 5));

    setSelectedCell({ row: clampedRow, col: clampedCol });
    if (onRowSelect) onRowSelect(clampedRow);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing || !selectedCell) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        navigateTo(selectedCell.row - 1, selectedCell.col);
        break;
      case "ArrowDown":
        e.preventDefault();
        navigateTo(selectedCell.row + 1, selectedCell.col);
        break;
      case "ArrowLeft":
        e.preventDefault();
        navigateTo(selectedCell.row, selectedCell.col - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateTo(selectedCell.row, selectedCell.col + 1);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedCell.col > 0) {
            navigateTo(selectedCell.row, selectedCell.col - 1);
          } else if (selectedCell.row > 0) {
            navigateTo(selectedCell.row - 1, 5);
          }
        } else {
          if (selectedCell.col < 5) {
            navigateTo(selectedCell.row, selectedCell.col + 1);
          } else if (selectedCell.row < safeItems.length - 1) {
            navigateTo(selectedCell.row + 1, 0);
          }
        }
        break;
      case "Enter":
      case "F2":
        e.preventDefault();
        startEditing(selectedCell.row, selectedCell.col);
        break;
      case "Escape":
        e.preventDefault();
        setSelectedCell(null);
        setIsEditing(false);
        if (onDeselect) onDeselect();
        break;
      default:
        if (
          selectedCell.col >= 3 &&
          !isReadOnly &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          /[\d.]/.test(e.key)
        ) {
          e.preventDefault();
          startEditing(selectedCell.row, selectedCell.col, e.key);
        }
        break;
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selectedCell) return;

    if (e.key === "Enter") {
      e.preventDefault();
      commitPriceChange(selectedCell.row, selectedCell.col, editValue);
      setIsEditing(false);
      navigateTo(selectedCell.row + 1, selectedCell.col);
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitPriceChange(selectedCell.row, selectedCell.col, editValue);
      setIsEditing(false);
      if (e.shiftKey) {
        navigateTo(selectedCell.row, Math.max(0, selectedCell.col - 1));
      } else {
        navigateTo(selectedCell.row, Math.min(5, selectedCell.col + 1));
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  const handleInputBlur = () => {
    if (selectedCell && isEditing) {
      commitPriceChange(selectedCell.row, selectedCell.col, editValue);
    }
    setIsEditing(false);
  };

  const cell: React.CSSProperties = {
    border: "1px solid #000",
    padding: "2px 4px",
    fontSize: "13px",
    verticalAlign: "middle",
  };
  const headerCell: React.CSSProperties = {
    ...cell,
    fontWeight: "700",
    textAlign: "center",
    background: "#fff",
    padding: 0,
  };
  const cellLeft: React.CSSProperties = { ...cell, borderLeft: "none" };
  const cellRight: React.CSSProperties = { ...cell, borderRight: "none" };
  const headerCellLeft: React.CSSProperties = { ...headerCell, borderLeft: "none" };
  const headerCellRight: React.CSSProperties = { ...headerCell, borderRight: "none" };

  return (
    <div
      ref={gridContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="outline-none focus:outline-none select-none"
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          borderLeft: "none",
          borderRight: "none",
          marginBottom: "15px",
          fontSize: "13px",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...headerCellLeft, width: "26px" }} rowSpan={3}>
              NO.
            </th>
            <th style={{ ...headerCell, width: "35%" }} rowSpan={3}>
              DESCRIPTION
            </th>
            <th style={{ ...headerCell, width: "38px" }} rowSpan={3}>
              QTY
            </th>
            <th style={{ ...headerCell, width: "34px" }} rowSpan={3}>
              UNIT
            </th>
            <th style={{ ...headerCellRight }} colSpan={safeQuotes.length * 2}>
              SUPPLIER&apos;S NAME
            </th>
          </tr>
          <tr>
            {safeQuotes.map((q, i) => (
              <th
                key={i}
                style={{
                  ...(i === safeQuotes.length - 1 ? headerCellRight : headerCell),
                  fontSize: "13px",
                }}
                colSpan={2}
              >
                {q ? q.supplier?.name?.toUpperCase() : `SUPPLIER ${i + 1}`}
              </th>
            ))}
          </tr>
          <tr>
            {safeQuotes.map((_, i) => (
              <React.Fragment key={i}>
                <th key={`up-${i}`} style={{ ...headerCell, width: "8%", fontSize: "13px" }}>
                  UNIT PRICE
                </th>
                <th
                  key={`tp-${i}`}
                  style={{
                    ...(i === safeQuotes.length - 1 ? headerCellRight : headerCell),
                    width: "8%",
                    fontSize: "13px",
                  }}
                >
                  TOTAL PRICE
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeItems.map((item, idx) => {
            const hasBreak = pageBreaks.includes(idx);
            const isSpec = !item.quantity || Number(item.quantity) === 0;

            let displayNo = "";
            if (!isSpec) {
              let count = 0;
              for (let i = 0; i <= idx; i++) {
                if (Number(safeItems[i].quantity) > 0) count++;
              }
              displayNo = count.toString();
            }

            const hasSpecs =
              !isSpec &&
              idx + 1 < safeItems.length &&
              (!safeItems[idx + 1].quantity || Number(safeItems[idx + 1].quantity) === 0);

            const isRowSelected = selectedCell?.row === idx || activeItemIndex === idx;

            return (
              <tr
                key={item.id || idx}
                className={`group ${hasBreak ? "break-before-page" : ""}`}
                style={
                  hasBreak ? { pageBreakBefore: "always", breakBefore: "page" } : {}
                }
              >
                {/* Col: Item No */}
                <td
                  style={{
                    ...cellLeft,
                    textAlign: "center",
                    fontWeight: "700",
                    verticalAlign: "top",
                    position: "relative",
                  }}
                >
                  {!isReadOnly && onTogglePageBreak && (
                    <div
                      className="absolute top-0 left-[-24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-print z-50 -translate-y-1/2"
                      onClick={() => onTogglePageBreak(idx)}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ${
                          hasBreak
                            ? "bg-red-500 hover:bg-red-600"
                            : "bg-blue-500 hover:bg-blue-600"
                        }`}
                        title={hasBreak ? "Remove Page Break" : "Insert Page Break Above"}
                      >
                        {hasBreak ? <Minus size={12} /> : <Plus size={12} />}
                      </div>
                    </div>
                  )}
                  {hasBreak && (
                    <div
                      className="absolute top-0 left-0 w-[1168px] h-0 border-t-[3px] border-dashed border-red-400 z-40 no-print"
                      style={{ pointerEvents: "none" }}
                    ></div>
                  )}
                  {displayNo}
                </td>

                {/* Col 0: Description */}
                <td
                  onClick={() => handleCellClick(idx, 0)}
                  style={{
                    ...cell,
                    fontWeight: isSpec ? "normal" : hasSpecs ? "bold" : "normal",
                    paddingLeft: "0.5rem",
                    position: "relative",
                  }}
                  className={`${!isReadOnly ? "cursor-cell" : ""} ${
                    selectedCell?.row === idx && selectedCell?.col === 0
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  <FormattedCellText text={item.description} fallback={"\u00A0"} />
                  {selectedCell?.row === idx && selectedCell?.col === 0 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 1: Quantity */}
                <td
                  onClick={() => handleCellClick(idx, 1)}
                  style={{
                    ...cell,
                    textAlign: "center",
                    position: "relative",
                  }}
                  className={`${!isReadOnly ? "cursor-cell" : ""} ${
                    selectedCell?.row === idx && selectedCell?.col === 1
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  <span>{isSpec ? "" : item.quantity}</span>
                  {selectedCell?.row === idx && selectedCell?.col === 1 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Col 2: Unit */}
                <td
                  onClick={() => handleCellClick(idx, 2)}
                  style={{
                    ...cell,
                    textAlign: "center",
                    position: "relative",
                  }}
                  className={`${!isReadOnly ? "cursor-cell" : ""} ${
                    selectedCell?.row === idx && selectedCell?.col === 2
                      ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                      : ""
                  }`}
                >
                  <span>{isSpec ? "" : item.unit}</span>
                  {selectedCell?.row === idx && selectedCell?.col === 2 && !isEditing && (
                    <div
                      className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                      style={{ border: "1px solid #ffffff" }}
                    />
                  )}
                </td>

                {/* Supplier Columns (Cols 3, 4, 5 for unit prices) */}
                {safeQuotes.map((q, qi) => {
                  const prices = q ? getPrice(q, item.id) : { unitPrice: 0, totalPrice: 0 };
                  const colIdx = 3 + qi;
                  const isUnitSelected =
                    selectedCell?.row === idx && selectedCell?.col === colIdx;
                  const isUnitEditing = isEditing && isUnitSelected;

                  return (
                    <React.Fragment key={qi}>
                      {/* Unit Price (Editable) */}
                      <td
                        key={`up-${qi}`}
                        onClick={() => handleCellClick(idx, colIdx)}
                        onDoubleClick={() => handleCellDoubleClick(idx, colIdx)}
                        style={{
                          ...cell,
                          textAlign: "right",
                          position: "relative",
                        }}
                        className={`${!isReadOnly && !isSpec ? "cursor-cell" : ""} ${
                          isUnitSelected
                            ? "outline outline-2 outline-[#1d4ed8] -outline-offset-2 bg-[#1d4ed8]/10 z-20"
                            : ""
                        }`}
                      >
                        {isUnitEditing ? (
                          <input
                            ref={activeInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            onBlur={handleInputBlur}
                            className="w-full h-full text-right bg-white border-0 outline-none p-0 m-0 leading-tight text-[13px]"
                            style={{ fontSize: "13px" }}
                          />
                        ) : (
                          <span>{isSpec ? "" : fmt2(prices.unitPrice)}</span>
                        )}

                        {isUnitSelected && !isUnitEditing && (
                          <div
                            className="absolute -bottom-[2px] -right-[2px] w-[5px] h-[5px] bg-[#1d4ed8] pointer-events-none no-print z-30"
                            style={{ border: "1px solid #ffffff" }}
                          />
                        )}
                      </td>

                      {/* Total Price (Static computed) */}
                      <td
                        key={`tp-${qi}`}
                        style={{
                          ...(qi === safeQuotes.length - 1 ? cellRight : cell),
                          textAlign: "right",
                        }}
                      >
                        {isSpec ? "" : fmt2(prices.totalPrice)}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            );
          })}

          {/* Empty rows filler */}
          {Array.from({ length: Math.max(0, targetRows - safeItems.length) }).map((_, i) => {
            const idx = `fill-${i}`;
            const hasBreak = pageBreaks.includes(idx);
            return (
              <tr
                key={idx}
                className={`group ${hasBreak ? "break-before-page" : ""}`}
                style={
                  hasBreak
                    ? { pageBreakBefore: "always", breakBefore: "page", height: "24px" }
                    : { height: "24px" }
                }
              >
                <td style={{ ...cellLeft, position: "relative" }}>
                  {!isReadOnly && onTogglePageBreak && (
                    <div
                      className="absolute top-0 left-[-24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-print z-50 -translate-y-1/2"
                      onClick={() => onTogglePageBreak(idx)}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ${
                          hasBreak
                            ? "bg-red-500 hover:bg-red-600"
                            : "bg-blue-500 hover:bg-blue-600"
                        }`}
                        title={hasBreak ? "Remove Page Break" : "Insert Page Break Above"}
                      >
                        {hasBreak ? <Minus size={12} /> : <Plus size={12} />}
                      </div>
                    </div>
                  )}
                  {hasBreak && (
                    <div
                      className="absolute top-0 left-0 w-[1168px] h-0 border-t-[3px] border-dashed border-red-400 z-40 no-print"
                      style={{ pointerEvents: "none" }}
                    ></div>
                  )}
                </td>
                <td style={cell}></td>
                <td style={cell}></td>
                <td style={cell}></td>
                {safeQuotes.map((_, qi) => (
                  <React.Fragment key={qi}>
                    <td key={`fu-${qi}`} style={cell}></td>
                    <td
                      key={`ft-${qi}`}
                      style={qi === safeQuotes.length - 1 ? cellRight : cell}
                    ></td>
                  </React.Fragment>
                ))}
              </tr>
            );
          })}

          {/* TOTAL row */}
          <tr
            className={`group ${pageBreaks.includes("total") ? "break-before-page" : ""}`}
            style={
              pageBreaks.includes("total")
                ? { pageBreakBefore: "always", breakBefore: "page" }
                : {}
            }
          >
            <td
              style={{
                ...headerCellLeft,
                borderTop: "2px solid #000",
                textAlign: "center",
                position: "relative",
              }}
              colSpan={4}
            >
              {!isReadOnly && onTogglePageBreak && (
                <div
                  className="absolute top-0 left-[-24px] h-[24px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer no-print z-50 -translate-y-1/2"
                  onClick={() => onTogglePageBreak("total")}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm ${
                      pageBreaks.includes("total")
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-blue-500 hover:bg-blue-600"
                    }`}
                    title={
                      pageBreaks.includes("total")
                        ? "Remove Page Break"
                        : "Insert Page Break Above"
                    }
                  >
                    {pageBreaks.includes("total") ? <Minus size={12} /> : <Plus size={12} />}
                  </div>
                </div>
              )}
              {pageBreaks.includes("total") && (
                <div
                  className="absolute top-0 left-0 w-[1168px] h-0 border-t-[3px] border-dashed border-red-400 z-40 no-print"
                  style={{ pointerEvents: "none" }}
                ></div>
              )}
              TOTAL
            </td>
            {safeQuotes.map((q, qi) => (
              <React.Fragment key={qi}>
                <td key={`tot-u-${qi}`} style={{ ...cell, borderTop: "2px solid #000" }}></td>
                <td
                  key={`tot-t-${qi}`}
                  style={{
                    ...(qi === safeQuotes.length - 1 ? cellRight : cell),
                    borderTop: "2px solid #000",
                    textAlign: "right",
                    fontWeight: "700",
                  }}
                >
                  {q && q.totalAmount > 0 ? fmt2(q.totalAmount) : ""}
                </td>
              </React.Fragment>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
