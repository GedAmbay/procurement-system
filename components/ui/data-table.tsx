"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Pencil, Trash2, CheckCircle, XCircle, Loader2, RefreshCw, Eye, Copy, X } from "lucide-react";
import { toast } from "sonner";

interface Column<T> {
  key: string;
  label: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  width?: string;
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
  extraHeaderContent?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  queryParams?: Record<string, string>;
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
  extraHeaderContent,
  emptyIcon,
  emptyText,
  queryParams = {},
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);

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

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>{title}</h2>
          {description && <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>{description}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.625rem", alignItems: "center", flexWrap: "wrap" }}>
          {extraHeaderContent}
          <div className="search-input" style={{ minWidth: "220px" }}>
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
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "0.75rem", color: "#94a3b8" }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            Loading...
          </div>
        ) : data.length === 0 ? (
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
          <div className="table-container" style={{ border: "none", borderRadius: "0.75rem" }}>
            <table>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} style={{ width: col.width }}>{col.label}</th>
                  ))}

                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      opacity: row.isActive === false ? 0.5 : 1,
                      cursor: (onView || onEdit || onDuplicate || onDelete) ? "pointer" : "default",
                      backgroundColor: selectedRow?.id === row.id ? "#f1f5f9" : "transparent"
                    }}
                    onClick={() => {
                      if (onView || onEdit || onDuplicate || onDelete) setSelectedRow(row);
                    }}
                  >
                    {columns.map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(row) : String((row as any)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Footer count */}
        {!loading && data.length > 0 && (
          <div style={{ padding: "0.625rem 1rem", borderTop: "1px solid #f1f5f9", color: "#94a3b8", fontSize: "0.75rem" }}>
            {data.length} record{data.length !== 1 ? "s" : ""} {search ? `matching "${search}"` : "total"}
          </div>
        )}
      </div>

      {selectedRow && (onView || onEdit || onDuplicate || onDelete) && (
        <div style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "60%",
          transform: "translateX(-50%)",
          backgroundColor: "#ffffffff",
          color: "white",
          borderRadius: "0.5rem",
          display: "flex",
          alignItems: "center",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          zIndex: 50,
          overflow: "hidden"
        }}>
          <div className="btn btn-secondary" style={{
            padding: "0.75rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            marginLeft: "1rem",
            marginRight: "1rem"
          }}>
            1 Record Selected
          </div>

          <div style={{ display: "flex", alignItems: "center", padding: "0 0.5rem" }}>
            {onView && (
              <button
                onClick={() => { onView(selectedRow); setSelectedRow(null); }}
                style={{ background: "none", border: "none", color: "#1e293b", padding: "1rem 3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem" }}
              >
                <Eye size={16} /> View
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => { onEdit(selectedRow); setSelectedRow(null); }}
                style={{ background: "none", border: "none", color: "#1e293b", padding: "1rem 3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem" }}
              >
                <Pencil size={16} /> Edit
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={() => { onDuplicate(selectedRow); setSelectedRow(null); }}
                style={{ background: "none", border: "none", color: "#1e293b", padding: "1rem 2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem" }}
              >
                <Copy size={16} /> Duplicate
              </button>
            )}
            {onDelete && selectedRow.isActive !== false && (
              <button
                onClick={() => { handleDelete(selectedRow); setSelectedRow(null); }}
                disabled={deleting === selectedRow.id}
                style={{ background: "none", border: "none", color: "white", padding: "1rem 5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", cursor: "pointer", fontSize: "0.75rem", opacity: deleting === selectedRow.id ? 0.5 : 1 }}
              >
                {deleting === selectedRow.id ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={16} />}
                Delete
              </button>
            )}
          </div>

          <div style={{ padding: "0 1rem", borderLeft: "1px solid #334155", display: "flex", alignItems: "center", alignSelf: "stretch" }}>
            <button
              onClick={() => setSelectedRow(null)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: "0.25rem", display: "flex" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )
      }

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div >
  );
}
