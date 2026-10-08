"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Plus, Pencil, Trash2, CheckCircle, XCircle, Loader2, RefreshCw, Eye, Copy, X, Calendar } from "lucide-react";
import LoaderWave from "@/components/ui/loader-wave";
import { toast } from "sonner";

interface Column<T> {
  key: string;
  label: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right" | (string & {});
  sortable?: boolean;
}

interface DataTableProps<T extends { id: string; isActive?: boolean }> {
  title: string;
  description?: string;
  apiPath: string;
  columns: Column<T>[];
  searchPlaceholder?: string;
  onAdd?: () => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDuplicate?: (row: T) => void;
  onDelete?: (row: T) => Promise<void>;
  customActions?: { label: string; icon: React.ReactNode; onClick: (row: T) => void }[];
  extraHeaderContent?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  queryParams?: Record<string, string>;
  filterKey?: keyof T;
  filterTabs?: { label: string; value: string | null }[];
  dateFilterKey?: keyof T;
  customFilters?: { label: string; filterFn: (row: T) => boolean; colorClass?: string }[];
}

export default function DataTable<T extends { id: string; isActive?: boolean }>({
  title,
  description,
  apiPath,
  columns,
  searchPlaceholder = "Search...",
  onAdd,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  customActions,
  extraHeaderContent,
  emptyIcon,
  emptyText,
  queryParams = {},
  filterKey,
  filterTabs,
  dateFilterKey,
  customFilters,
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const [showActionBar, setShowActionBar] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCustomFilter, setActiveCustomFilter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: "asc" | "desc" } | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string, end: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionBarRef.current && !actionBarRef.current.contains(event.target as Node)) {
        setSelectedRow(null);
      }
    }
    if (showActionBar) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showActionBar]);

  useEffect(() => {
    if (selectedRow) {
      setShowActionBar(true);
      setIsClosing(false);
    } else if (showActionBar) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShowActionBar(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedRow, showActionBar]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...queryParams, ...(search ? { search } : {}) });
      const res = await fetch(`${apiPath}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [apiPath, search, JSON.stringify(queryParams)]);

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter]);

  const filteredData = data.filter(row => {
    // Tab Filter
    if (filterKey && activeFilter && row[filterKey] !== activeFilter) return false;
    
    // Date Filter
    if (dateFilterKey && dateRange && dateRange.start && dateRange.end) {
      const rowDate = new Date(row[dateFilterKey] as any);
      const startDate = new Date(dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      if (rowDate < startDate || rowDate > endDate) return false;
    }

    // Custom Filter
    if (activeCustomFilter && customFilters) {
      const filter = customFilters.find(f => f.label === activeCustomFilter);
      if (filter && !filter.filterFn(row)) return false;
    }

    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    const aValue = a[sortConfig.key as keyof T];
    const bValue = b[sortConfig.key as keyof T];
    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    }
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDelete = async (row: T) => {
    if (!onDelete) return;
    if (!confirm(`Are you sure you want to deactivate this record?`)) return;
    setDeleting(row.id);
    try {
      await onDelete(row);
      toast.success("Record deactivated successfully");
      fetchData();
    } catch (e) {
      toast.error("Failed to delete record");
    } finally {
      setDeleting(null);
    }
  };

  const renderDateFilter = () => {
    if (!dateFilterKey) return null;
    return (
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "#ffffff", border: "1px solid #e2e8f0", padding: "0.4rem 0.75rem",
            borderRadius: "9999px", fontSize: "0.8125rem", color: "#334155", fontWeight: "600",
            cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}
        >
          <Calendar size={14} color="#475569" />
          {dateRange?.start && dateRange?.end ? (
            `${new Date(dateRange.start).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${new Date(dateRange.end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          ) : (
            "Filter by Date"
          )}
          {dateRange && (
            <X size={12} style={{ marginLeft: "0.25rem", opacity: 0.5 }} onClick={(e) => { e.stopPropagation(); setDateRange(null); }} />
          )}
        </button>

        {showDatePicker && (
          <div style={{
            position: "absolute", top: "100%", right: 0, marginTop: "0.5rem",
            background: "white", padding: "1rem", borderRadius: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            border: "1px solid #e2e8f0", zIndex: 50, width: "250px"
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem", fontWeight: "500" }}>Start Date</label>
                <input 
                  type="date" 
                  value={dateRange?.start || ""}
                  onChange={(e) => setDateRange(prev => ({ start: e.target.value, end: prev?.end || "" }))}
                  style={{ width: "100%", padding: "0.375rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem" }} 
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem", fontWeight: "500" }}>End Date</label>
                <input 
                  type="date"
                  value={dateRange?.end || ""}
                  onChange={(e) => setDateRange(prev => ({ start: prev?.start || "", end: e.target.value }))}
                  style={{ width: "100%", padding: "0.375rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", fontSize: "0.875rem" }}
                />
              </div>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => setShowDatePicker(false)}
                style={{ marginTop: "0.5rem" }}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.625rem", alignItems: "center", flexWrap: "wrap" }}>
          {extraHeaderContent}
          <div className="search-input" style={{ minWidth: "400px" }}>
            <Search size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          {onAdd && (
            <button className="btn btn-primary btn-sm" onClick={onAdd}>
              <Plus size={15} /> Add New
            </button>
          )}
          {(!filterTabs || filterTabs.length === 0) && renderDateFilter()}
        </div>
        {!loading && (
          <div style={{ display: "flex", alignItems: "center", height: "36px", color: "#64748b", fontSize: "0.875rem", fontWeight: "500" }}>
            {filteredData.length} record{filteredData.length !== 1 ? "s" : ""} {search ? `matching "${search}"` : "total"}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      {filterTabs && filterKey && filterTabs.length > 0 ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid #e2e8f0" }}>
          
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {filterTabs.map((tab) => {
              const count = tab.value === null 
                ? data.length 
                : data.filter(row => row[filterKey] === tab.value).length;
              const isActive = activeFilter === tab.value;
              
              return (
                <button
                  key={tab.label}
                  onClick={() => setActiveFilter(tab.value)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "0.75rem 0.25rem",
                    fontSize: "0.875rem",
                    fontWeight: isActive ? "600" : "500",
                    color: isActive ? "#334155" : "#94a3b8",
                    borderBottom: isActive ? "2px solid #475569" : "2px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
            
            {customFilters && customFilters.map(filter => {
              const isActive = activeCustomFilter === filter.label;
              return (
                <button
                  key={filter.label}
                  onClick={() => setActiveCustomFilter(isActive ? null : filter.label)}
                  style={{
                    background: isActive ? (filter.colorClass ? "transparent" : "#f1f5f9") : "none",
                    border: "none",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: isActive ? "600" : "500",
                    color: isActive ? "#0f172a" : "#64748b",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    alignSelf: "center",
                    marginLeft: "1rem"
                  }}
                  className={isActive && filter.colorClass ? filter.colorClass : ""}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {renderDateFilter()}
        </div>
      ) : null}

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <LoaderWave />
        ) : filteredData.length === 0 ? (
          <div className="empty-state">
            {emptyIcon ?? <Search size={40} style={{ opacity: 0.3 }} />}
            <p style={{ fontWeight: "600", color: "#64748b", margin: "0.5rem 0 0.25rem" }}>
              {emptyText ?? "No records found"}
            </p>
            {search && <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Try adjusting your search query</p>}
            {onAdd && !search && (
              <button className="btn btn-primary btn-sm" onClick={onAdd} style={{ marginTop: "0.75rem" }}>
                <Plus size={14} /> Add First Record
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} style={{ width: col.width, textAlign: (col.align || "left") as any }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        {col.label}
                        {col.sortable && (
                          <button
                            onClick={() => {
                              let nextDirection: "asc" | "desc" = "asc";
                              if (sortConfig?.key === col.key && sortConfig.direction === "asc") {
                                nextDirection = "desc";
                              }
                              setSortConfig({ key: col.key, direction: nextDirection });
                            }}
                            style={{
                              background: "none", border: "none", cursor: "pointer", padding: "2px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: sortConfig?.key === col.key ? 1 : 0.4,
                              color: sortConfig?.key === col.key ? "#0f172a" : "#94a3b8",
                              fontSize: "0.6rem"
                            }}
                          >
                            {sortConfig?.key === col.key && sortConfig.direction === "asc" ? "▲" : "▼"}
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      opacity: row.isActive === false ? 0.5 : 1,
                      cursor: (onView || onEdit || onDuplicate || onDelete) ? "pointer" : "default",
                      backgroundColor: selectedRow?.id === row.id ? "#f1f5f9" : "transparent",
                    }}
                    onClick={() => {
                      if (onView || onEdit || onDuplicate || onDelete) setSelectedRow(row);
                    }}
                    onDoubleClick={() => {
                      if (onView) onView(row);
                      else if (onEdit) onEdit(row);
                    }}
                  >
                    {columns.map((col) => (
                      <td key={col.key} style={{ textAlign: (col.align || "left") as any }}>
                        {col.render ? col.render(row) : String((row as any)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Pagination Footer */}
      {!loading && data.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "1rem 0.5rem", gap: "1rem", color: "#64748b", fontSize: "0.875rem", fontWeight: "500" }}>
          <span>Page {currentPage} of {totalPages}</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button 
              className="btn btn-secondary btn-sm" 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{ padding: "0.25rem 0.75rem", opacity: currentPage === 1 ? 0.5 : 1 }}
            >
              Prev
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{ padding: "0.25rem 0.75rem", opacity: currentPage === totalPages ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {showActionBar && (onView || onEdit || onDuplicate || onDelete || customActions) && (
        <div ref={actionBarRef} style={{
          position: "fixed",
          bottom: "2rem",
          left: "55%",
          transform: "translateX(-50%)",
          animation: isClosing ? "modalSlideDown 0.3s forwards cubic-bezier(0.16, 1, 0.3, 1)" : "modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          backgroundColor: "#e0e5ec",
          color: "#334155",
          borderRadius: "1rem",
          display: "flex",
          alignItems: "center",
          boxShadow: "9px 9px 16px rgba(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
          zIndex: 50,
          padding: "0.75rem",
          gap: "1rem"
        }}>
          <div style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: "600",
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            backgroundColor: "#e0e5ec",
            borderRadius: "0.75rem",
            boxShadow: "inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255, 0.5)"
          }}>
            1 Record Selected
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {onView && (
              <button
                onClick={() => { if (selectedRow) onView(selectedRow); setSelectedRow(null); }}
                style={{ background: "#e0e5ec", border: "none", color: "#475569", padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem", borderRadius: "0.5rem", boxShadow: "4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255, 0.5)" }}
              >
                <Eye size={16} /> View
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => { if (selectedRow) onEdit(selectedRow); setSelectedRow(null); }}
                style={{ background: "#e0e5ec", border: "none", color: "#475569", padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem", borderRadius: "0.5rem", boxShadow: "4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255, 0.5)" }}
              >
                <Pencil size={16} /> Edit
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={() => { if (selectedRow) onDuplicate(selectedRow); setSelectedRow(null); }}
                style={{ background: "#e0e5ec", border: "none", color: "#475569", padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem", borderRadius: "0.5rem", boxShadow: "4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255, 0.5)" }}
              >
                <Copy size={16} /> Duplicate
              </button>
            )}
            {customActions && customActions.map((action, i) => (
              <button
                key={i}
                onClick={() => { if (selectedRow) action.onClick(selectedRow); setSelectedRow(null); }}
                style={{ background: "#e0e5ec", border: "none", color: "#475569", padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem", borderRadius: "0.5rem", boxShadow: "4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255, 0.5)" }}
              >
                {action.icon} {action.label}
              </button>
            ))}
            {onDelete && selectedRow?.isActive !== false && (
              <button
                onClick={() => { if (selectedRow) handleDelete(selectedRow); setSelectedRow(null); }}
                disabled={deleting === selectedRow?.id}
                style={{ background: "#e0e5ec", border: "none", color: "#ef4444", padding: "0.75rem 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem", borderRadius: "0.5rem", boxShadow: "4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255, 0.5)", opacity: deleting === selectedRow?.id ? 0.5 : 1 }}
              >
                {deleting === selectedRow?.id ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={16} />}
                Delete
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", marginLeft: "0.5rem" }}>
            <button
              onClick={() => setSelectedRow(null)}
              style={{ background: "#e0e5ec", border: "none", color: "#94a3b8", cursor: "pointer", padding: "0.5rem", display: "flex", borderRadius: "50%", boxShadow: "4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255, 0.5)" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes modalSlideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes modalSlideDown { from { transform: translate(-50%, 0); opacity: 1; } to { transform: translate(-50%, 100%); opacity: 0; } }
      `}</style>
    </div >
  );
}
