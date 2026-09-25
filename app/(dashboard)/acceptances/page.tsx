"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Eye, Printer } from "lucide-react";
import DataTable from "@/components/ui/data-table";

interface Acceptance {
  id: string;
  iarNumber: string;
  po: { poNumber: string; supplier: { name: string } };
  status: string;
  createdAt: string;
}

export default function AcceptancesPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  const columns = [
    {
      key: "iarNumber",
      label: "IAR Number",
      render: (row: Acceptance) => (
        <div style={{ fontWeight: "600", color: "#0f172a", fontFamily: "monospace", fontSize: "0.875rem" }}>
          {row.iarNumber}
        </div>
      ),
      width: "160px",
    },
    {
      key: "poNumber",
      label: "PO Number",
      render: (row: Acceptance) => (
        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "0.875rem" }}>
          {row.po?.poNumber || "N/A"}
        </div>
      ),
      width: "200px",
    },
    {
      key: "supplier",
      label: "Supplier",
      align: "left",
      render: (row: Acceptance) => (
        <div style={{ fontSize: "0.875rem", color: "#334155" }}>
          {row.po?.supplier?.name || "N/A"}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      render: (row: Acceptance) => {
        const bg = row.status === "DRAFT" ? "#fef3c7" : "#f0fdf4";
        const color = row.status === "DRAFT" ? "#b45309" : "#16a34a";
        return (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            padding: "0.25rem 0.625rem", borderRadius: "9999px",
            fontSize: "0.75rem", fontWeight: "600",
            backgroundColor: bg, color: color,
            textTransform: "uppercase"
          }}>
            {row.status.replace(/_/g, " ")}
          </span>
        );
      },
      width: "140px",
    },
    {
      key: "createdAt",
      label: "Date Created",
      align: "center",
      render: (row: Acceptance) => (
        <span style={{ fontSize: "0.8125rem", color: "#64748b", display: "block" }}>
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "140px",
    }
  ];

  return (
    <div>
      <DataTable<Acceptance>
        key={refreshKey}
        title="Acceptance and Inspection"
        description="Manage Inspection and Acceptance Reports (IAR) for deliveries"
        apiPath="/api/acceptances"
        columns={columns}
        searchPlaceholder="Search IAR..."
        onView={(row) => router.push(`/acceptances/${row.id}`)}
        onEdit={(row) => router.push(`/acceptances/${row.id}`)}
        emptyIcon={<CheckSquare size={40} style={{ opacity: 0.3 }} />}
        emptyText="No Acceptance Reports found"
      />
    </div>
  );
}
