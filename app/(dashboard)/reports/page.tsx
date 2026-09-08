import { BarChart3 } from "lucide-react";
export default function ReportsPage() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
      <BarChart3 size={48} color="#e2e8f0" style={{ margin: "0 auto 1rem" }} />
      <h3 style={{ color: "#64748b", fontWeight: "600" }}>Reports & Analytics</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Phase 9 — Procurement status reports, APP monitoring, supplier performance. Coming next.</p>
    </div>
  );
}
