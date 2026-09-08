import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function getCurrentFiscalYear(): number {
  return new Date().getFullYear();
}

export function generateDocNumber(
  prefix: string,
  year: number,
  month: number,
  sequence: number
): string {
  return `${prefix}-${year}-${String(month).padStart(2, "0")}-${String(sequence).padStart(4, "0")}`;
}

export const ROLES = {
  ADMIN: "ADMIN",
  BAC_SECRETARIAT: "BAC_SECRETARIAT",
  END_USER: "END_USER",
  BUDGET_OFFICER: "BUDGET_OFFICER",
  SUPPLY_OFFICER: "SUPPLY_OFFICER",
  APPROVING_OFFICIAL: "APPROVING_OFFICIAL",
  VIEWER: "VIEWER",
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "System Administrator",
  BAC_SECRETARIAT: "BAC Secretariat",
  END_USER: "End User / Requesting Office",
  BUDGET_OFFICER: "Budget Officer",
  SUPPLY_OFFICER: "Supply / Property Officer",
  APPROVING_OFFICIAL: "Approving Official",
  VIEWER: "Viewer (Read-only)",
};

export const PR_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  FOR_RFQ: "For RFQ",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

export const PR_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  FOR_RFQ: "bg-blue-100 text-blue-700",
  CLOSED: "bg-gray-100 text-gray-600",
  REJECTED: "bg-red-100 text-red-700",
};

export const LGU_INFO = {
  name: "Municipality of Pandan",
  province: "Province of Antique",
  region: "Region VI (Western Visayas)",
  republic: "Republic of the Philippines",
  address: "Pandan, Antique",
  contact: "(044) 123-4567",
  email: "pandan.lgu@example.gov.ph",
  logoUrl: "/lgu-seal.png",
} as const;
