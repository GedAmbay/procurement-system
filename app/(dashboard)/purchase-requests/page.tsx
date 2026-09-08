import Link from "next/link";
import { ShoppingCart, Plus, ArrowRight } from "lucide-react";

export default function PurchaseRequestsPage() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: "700", color: "#0f172a", margin: 0 }}>Purchase Requests</h2>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
            Phase 4 — Coming in the next build session
          </p>
        </div>
        <Link href="/dashboard/purchase-requests/new" className="btn btn-primary btn-sm">
          <Plus size={15} /> New PR
        </Link>
      </div>

      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <ShoppingCart size={48} color="#e2e8f0" style={{ margin: "0 auto 1rem" }} />
        <h3 style={{ color: "#64748b", fontWeight: "600" }}>Purchase Requests Module</h3>
        <p style={{ color: "#94a3b8", fontSize: "0.875rem", maxWidth: "480px", margin: "0.5rem auto" }}>
          The full PR module with split-view editor, live print preview, and status workflow will be built in Phase 4.
          The foundation (database schema, API routes, auth, dashboard) is complete.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          {["Draft", "Submitted", "Approved", "For RFQ", "Closed"].map((s) => (
            <span key={s} className="badge" style={{ background: "#f1f5f9", color: "#64748b", fontSize: "0.75rem", padding: "0.375rem 0.875rem" }}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
