"use client";

import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ProcurementStage } from "@/lib/procurement-folder";
import {
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit,
  ArrowRight,
  ChevronRight
} from "lucide-react";

interface FolderViewProps {
  folderData: any;
  stages: ProcurementStage[];
}

export default function FolderView({ folderData, stages }: FolderViewProps) {
  const totalAmount = folderData.totalAmount || 0;
  const activeStageIndex = stages.findIndex(s => s.state === "active");
  const currentStep = activeStageIndex === -1 ? stages.length : activeStageIndex + 1;
  const lastUpdated = formatDate(folderData.updatedAt || folderData.createdAt);
  const itemsCount = folderData.items ? folderData.items.length : 0;

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "1rem" }}>
      
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1.5rem", fontSize: "0.875rem", fontWeight: 600 }}>
        <Link href="/archives" style={{ color: "#64748b", textDecoration: "none" }}>Archives</Link>
        <ChevronRight size={14} color="#94a3b8" />
        <Link href={`/archives/${folderData.officeId}`} style={{ color: "#64748b", textDecoration: "none" }}>{folderData.office?.name || "Department"}</Link>
        <ChevronRight size={14} color="#94a3b8" />
        <span style={{ color: "#1e293b" }}>{folderData.prNumber}</span>
      </div>

      {/* Header Card */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <div className="inset" style={{ 
              display: "inline-block", 
              padding: "0.3rem 1rem", 
              fontSize: "0.75rem", 
              fontWeight: 600, 
              color: "#64748b",
              marginBottom: "1rem" 
            }}>
              PROCUREMENT FOLDER · FY {folderData.fiscalYear}
            </div>
            <h1 style={{ fontSize: "2rem", color: "#1e293b", margin: 0 }}>
              {folderData.purpose}
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem", textTransform: "uppercase" }}>Total amount</div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#10b981" }}>
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2rem", marginBottom: "3rem" }}>
          <div>
            <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>PR number</div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1.125rem" }}>{folderData.prNumber}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Requesting office</div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1.125rem" }}>{folderData.office?.name || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Fund source</div>
            {folderData.fundSource ? (
              <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1.125rem" }}>{folderData.fundSource.name}</div>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "#d97706", fontWeight: 600, fontSize: "1rem" }}>
                Not assigned · 
                <Link href={`/purchase-requests/${folderData.id}`} style={{ textDecoration: "underline" }}>Assign</Link>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.5rem" }}>Progress</div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "1.125rem" }}>
              Step {currentStep} of {stages.length}
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", padding: "0 2rem" }}>
          {/* Background line */}
          <div style={{ position: "absolute", left: "4rem", right: "4rem", top: "1.25rem", height: "6px", borderRadius: "3px", boxShadow: "var(--shadow-neu-inner)", zIndex: 0 }}></div>
          
          {/* Foreground line (green) */}
          <div style={{ position: "absolute", left: "4rem", top: "1.25rem", height: "6px", borderRadius: "3px", background: "#10b981", zIndex: 1, width: `calc(${Math.max(0, (currentStep - 1) / (stages.length - 1)) * 100}% - 8rem)`, transition: "width 0.5s ease" }}></div>

          {stages.map((stage, idx) => {
            const isDone = stage.state === "done";
            const isActive = stage.state === "active";
            const isPending = stage.state === "pending";

            let circleStyle: any = {
              width: "40px", height: "40px", borderRadius: "50%", 
              display: "flex", alignItems: "center", justifyContent: "center", 
              fontWeight: "bold", position: "relative", zIndex: 2,
              marginBottom: "1rem", fontSize: "1.125rem"
            };

            if (isDone) {
              circleStyle = { ...circleStyle, background: "#10b981", color: "white", boxShadow: "var(--shadow-neu-drop-sm)" };
            } else if (isActive) {
              circleStyle = { ...circleStyle, background: "#2563eb", color: "white", boxShadow: "var(--shadow-neu-drop)" };
            } else {
              circleStyle = { ...circleStyle, background: "var(--color-page-bg)", color: "#94a3b8", boxShadow: "var(--shadow-neu-inner-sm)" };
            }

            return (
              <div key={stage.key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={circleStyle}>
                  {isDone ? <CheckCircle2 size={20} /> : (idx + 1)}
                </div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: (isActive || isDone) ? "#1e293b" : "#94a3b8", marginBottom: "0.25rem" }}>
                  {stage.key}
                </div>
                <div style={{ fontSize: "0.75rem", color: isActive ? "#64748b" : "#94a3b8" }}>
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Document Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {stages.map((stage) => {
          const isDone = stage.state === "done";
          const isActive = stage.state === "active";
          const isPending = stage.state === "pending";

          // Pending Sections
          if (isPending) {
            return (
              <div key={stage.key} className="inset" style={{ 
                padding: "1.5rem 2rem", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center" 
              }}>
                <div style={{ fontWeight: 600, color: "#64748b", fontSize: "1.125rem" }}>{stage.label}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>
                  Waiting on previous step
                </div>
              </div>
            );
          }

          // Active / Done stages
          return (
            <div key={stage.key} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {stage.docs.length === 0 && isActive && (
                <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", margin: "0 0 0.5rem 0" }}>{stage.label}</h3>
                    <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>Ready to be created.</p>
                  </div>
                  <Link href={`/${stage.key.toLowerCase()}/new?prId=${folderData.id}`} className="btn btn-primary" style={{ padding: "0.8rem 1.5rem" }}>
                    Create {stage.key} <ArrowRight size={16} />
                  </Link>
                </div>
              )}

              {stage.docs.map((doc: any) => {
                let title = stage.label;
                let docId = doc.id;
                let editPath = "";
                let numberStr = "";
                
                switch (stage.key) {
                  case "PR": editPath = `/purchase-requests/${docId}`; numberStr = doc.prNumber; break;
                  case "RFQ": editPath = `/rfqs/${docId}`; numberStr = doc.rfqNumber; break;
                  case "AOQ": title = "Abstract of Canvass"; editPath = `/abstract/${docId}`; numberStr = doc.aoqNumber; break;
                  case "PO": editPath = `/purchase-orders/${docId}`; numberStr = doc.poNumber; break;
                  case "IAR": editPath = `/acceptances/${docId}`; numberStr = doc.iarNumber; break;
                }

                if (isDone || doc.status === "COMPLETED" || doc.status === "APPROVED") {
                  return (
                    <div key={docId} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 2rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                        <div style={{ 
                          background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "0.75rem", 
                          padding: "0.4rem 1rem", borderRadius: "1rem", textTransform: "uppercase" 
                        }}>
                          Completed
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}>{title}</span>
                            <span style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b" }}>{numberStr}</span>
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            Created {formatDate(doc.createdAt)} {stage.key === 'PR' ? `· ${itemsCount} items · ${formatCurrency(doc.totalAmount)}` : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        <Link href={`${editPath}?mode=view`} className="btn">
                          <Eye size={16} /> View
                        </Link>
                        <Link href={editPath} style={{ color: "#64748b", fontWeight: 600, fontSize: "0.875rem", textDecoration: "underline" }}>
                          Amend...
                        </Link>
                      </div>
                    </div>
                  );
                }

                // Active document
                return (
                  <div key={docId} className="card" style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                      <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>{title}</h2>
                      <div style={{ 
                          background: "#dbeafe", color: "#1d4ed8", fontWeight: 700, fontSize: "0.75rem", 
                          padding: "0.4rem 1rem", borderRadius: "1rem", textTransform: "uppercase" 
                        }}>
                        In progress
                      </div>
                    </div>
                    
                    <div className="inset" style={{ 
                      padding: "1.5rem 2rem", marginBottom: "1.5rem",
                      display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                          <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}>{numberStr}</span>
                          <span style={{ 
                            background: "#fef3c7", color: "#b45309", fontSize: "0.75rem", 
                            fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "0.5rem",
                            boxShadow: "var(--shadow-neu-drop-sm)"
                          }}>
                            {doc.status || "DRAFT"}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                          Created {formatDate(doc.createdAt)} {stage.key === 'RFQ' ? `· ${(doc.quotations || []).length} suppliers invited` : ''}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "1rem" }}>
                        <Link href={`${editPath}?mode=view`} className="btn">
                          <Eye size={16} /> View
                        </Link>
                        <Link href={editPath} className="btn">
                          <Edit size={16} /> Edit
                        </Link>
                      </div>
                    </div>

                    {stage.key === "RFQ" && (doc.quotations?.length || 0) < 3 && (
                      <div className="inset" style={{ 
                        padding: "1rem 1.5rem", 
                        display: "flex", gap: "1rem", alignItems: "center", marginBottom: "2rem" 
                      }}>
                        <AlertCircle size={20} color="#64748b" />
                        <div style={{ fontSize: "0.875rem", color: "#475569" }}>
                          <span style={{ fontWeight: 700 }}>Before you finalize:</span> add at least 3 suppliers and assign a fund source.
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.25rem" }}>Next: finalize the {stage.key}</div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Locks the document and prepares it for the next step.</div>
                      </div>
                      <div style={{ display: "flex", gap: "1rem" }}>
                        <Link href={editPath} className="btn">
                          Add suppliers
                        </Link>
                        <Link href={editPath} className="btn" style={{ padding: "0.8rem 1.5rem", background: "#2563eb", color: "#ffffff", boxShadow: "0 4px 12px rgba(37,99,235,0.4)" }}>
                          Finalize {stage.key}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
