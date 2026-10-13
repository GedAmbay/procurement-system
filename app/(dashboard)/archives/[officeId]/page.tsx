"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FileText, ArrowLeft, FolderOpen, ChevronRight, User } from "lucide-react";
import Link from "next/link";
import DataTable from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";

interface FolderRecord {
  id: string;
  prNumber: string;
  purpose: string;
  totalAmount: number;
  createdAt: string;
  requestedBy?: { name: string };
}

export default function OfficeArchivePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const officeId = params.officeId as string;
  const year = searchParams.get("year");

  const [officeName, setOfficeName] = useState("Loading...");

  useEffect(() => {
    async function loadOffice() {
      const res = await fetch(`/api/offices`);
      if (res.ok) {
        const offices = await res.json();
        const office = offices.find((o: any) => o.id === officeId);
        if (office) setOfficeName(office.name);
      }
    }
    loadOffice();
  }, [officeId]);

  const columns = [
    {
      key: "prNumber",
      label: "Folder ID (PR)",
      render: (row: FolderRecord) => (
        <div className="font-mono font-semibold text-slate-900 text-sm">{row.prNumber}</div>
      ),
      width: "160px",
    },
    {
      key: "purpose",
      label: "Purpose",
      align: "left",
      render: (row: FolderRecord) => (
        <div className="text-sm text-slate-700 max-w-[400px] truncate">{row.purpose}</div>
      ),
    },
    {
      key: "totalAmount",
      label: "Total Amount",
      align: "center",
      sortable: true,
      render: (row: FolderRecord) => (
        <div className="font-bold text-green-600">{formatCurrency(row.totalAmount)}</div>
      ),
      width: "140px",
    },

    {
      key: "createdAt",
      label: "Date Created",
      align: "center",
      sortable: true,
      render: (row: FolderRecord) => (
        <span className="text-[13px] text-slate-500">
          {new Date(row.createdAt).toLocaleDateString("en-PH")}
        </span>
      ),
      width: "120px",
    },

    {
      key: "requestedBy",
      label: "Created By",
      align: "center",
      render: (row: FolderRecord) => (
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-700 font-medium">
          <User size={13} className="text-slate-400" />
          <span>{row.requestedBy?.name || "—"}</span>
        </div>
      ),
      width: "150px",
    }
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1.5rem", fontSize: "0.875rem", fontWeight: 600, paddingLeft: "0.5rem" }}>
        <Link href={`/archives?year=${year}`} style={{ color: "#64748b", textDecoration: "none" }}>Archives</Link>
        <ChevronRight size={14} color="#94a3b8" />
        <span style={{ color: "#1e293b" }}>{officeName}</span>
      </div>

      <div className="flex items-center gap-4 mb-6 px-2 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {officeName}
          </h1>
          <p className="text-slate-500 mt-1">Folders for FY {year}</p>
        </div>
      </div>

      <div className="px-2 pb-4">
        <DataTable<FolderRecord>
          title="Procurement Folders"
          apiPath={`/api/purchase-requests?officeId=${officeId}&fiscalYear=${year}`}
          columns={columns}
          searchPlaceholder="Search purpose or folder ID..."
          onView={(row) => router.push(`/procurement-folders/${row.id}`)}
          emptyIcon={<FileText size={40} style={{ opacity: 0.3 }} />}
          emptyText="No folders found for this department and year"
          dateFilterKey="createdAt"
        />
      </div>
    </div>
  );
}
