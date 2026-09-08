import { FileText } from "lucide-react";
export default function RfqPage() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <FileText size={48} color="#e2e8f0" style={{ margin: "0 auto 1rem" }} />
      <h3 style={{ color: "#64748b", fontWeight: "600" }}>Requests for Quotation</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Phase 5 — Generated from approved PRs. Coming in the next build session.</p>
    </div>
  );
}
