import { History } from "lucide-react";
export default function AuditLogPage() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <History size={48} color="#e2e8f0" style={{ margin: "0 auto 1rem" }} />
      <h3 style={{ color: "#64748b", fontWeight: "600" }}>Audit Trail</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Phase 8 — Full audit logging per document, user, and action. Coming next.</p>
    </div>
  );
}
