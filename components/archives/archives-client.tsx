"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface ArchiveStats {
  id: string;
  name: string;
  code: string;
  head: string | null;
  count: number;
  finishedCount: number;
  activeCount: number;
}

interface ArchivesClientProps {
  archives: ArchiveStats[];
  fiscalYear: number;
  availableYears: number[];
}

export default function ArchivesClient({ archives, fiscalYear, availableYears }: ArchivesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", e.target.value);
    router.push(`?${params.toString()}`);
  };

  // Sort and filter
  const filtered = archives.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.head && a.head.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.count > 0 && b.count === 0) return -1;
    if (a.count === 0 && b.count > 0) return 1;
    return a.name.localeCompare(b.name);
  });

  const totalFolders = archives.reduce((sum, a) => sum + a.count, 0);
  const totalActive = archives.reduce((sum, a) => sum + a.activeCount, 0);
  const totalFinished = archives.reduce((sum, a) => sum + a.finishedCount, 0);

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", color: "#1e293b", margin: "0 0 0.25rem 0", fontWeight: 700 }}>
            Department archives
          </h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: "0.875rem" }}>
            Browse procurement folders by office
          </p>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search office or head"
            className="inset"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "0.5rem 1rem", border: "none", outline: "none", fontSize: "0.875rem", color: "#1e293b", width: "200px"
            }}
          />
          <div className="btn" style={{ padding: "0" }}>
            <select
              value={fiscalYear}
              onChange={handleYearChange}
              style={{
                background: "transparent", border: "none", padding: "0.5rem 1rem", outline: "none", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem", cursor: "pointer", appearance: "none"
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>FY {y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Well */}
      <div className="inset" style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", padding: "1.5rem 2rem", marginBottom: "2.5rem"
      }}>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Total folders</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{totalFolders}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Active</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#2563eb", lineHeight: 1 }}>{totalActive}</div>
        </div>
        <div>
          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Finished</div>
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>{totalFinished}</div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.5rem" }}>
        {sorted.map(office => {
          const isEmpty = office.count === 0;

          return (
            <div
              key={office.id}
              className={isEmpty ? "card" : "card stat-card"}
              onClick={() => {
                if (!isEmpty) router.push(`/archives/${office.id}`);
              }}
              style={{
                cursor: isEmpty ? "default" : "pointer",
                padding: "1.5rem",
                display: "flex", flexDirection: "column"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div className="inset" style={{
                    width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "0.875rem", color: isEmpty ? "#94a3b8" : "#2563eb", flexShrink: 0
                  }}>
                    {office.code}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: isEmpty ? "#64748b" : "#1e293b", margin: "0 0 0.25rem 0", lineHeight: 1.2 }}>
                      {office.name}
                    </h3>
                    {office.head && (
                      <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
                        {office.head}
                      </div>
                    )}
                  </div>
                </div>
                {!isEmpty && (
                  <ChevronRight size={16} color="#64748b" style={{ marginTop: "4px", flexShrink: 0 }} />
                )}
              </div>

              {isEmpty ? (
                <div className="inset" style={{ padding: "0.75rem 1rem", marginTop: "auto" }}>
                  <span style={{ fontSize: "0.875rem", color: "#94a3b8" }}>No folders in FY {fiscalYear}</span>
                </div>
              ) : (
                <div style={{ marginTop: "auto" }}>
                  <div className="inset" style={{ height: "10px", width: "100%", display: "flex", padding: "2px", gap: "2px", marginBottom: "0.75rem" }}>
                    {office.activeCount > 0 && (
                      <div style={{ height: "100%", background: "#2563eb", borderRadius: "4px", flex: office.activeCount }} />
                    )}
                    {office.finishedCount > 0 && (
                      <div style={{ height: "100%", background: "#10b981", borderRadius: "4px", flex: office.finishedCount }} />
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", fontWeight: 600 }}>
                    <div style={{ color: "#2563eb" }}>{office.activeCount} active</div>
                    <div style={{ color: "#10b981" }}>{office.finishedCount} finished</div>
                    <div style={{ color: "#94a3b8", fontWeight: 500 }}>{office.count} folder{office.count > 1 ? 's' : ''}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
