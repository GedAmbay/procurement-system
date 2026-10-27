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

export function normalizePrNumber(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const parts = trimmed.split("-");
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      parts[parts.length - 1] = lastPart.length < 3 ? lastPart.padStart(3, "0") : lastPart;
      return parts.join("-");
    }
  }
  return trimmed;
}

export function deriveRfqNumber(
  prNumber: string,
  fiscalYear?: number | null,
  fundSourceCode?: string | null
): string {
  if (!prNumber || !prNumber.trim()) return "";
  let fundPrefix = "GF";
  if (fundSourceCode && fundSourceCode.toUpperCase().startsWith("TF")) {
    fundPrefix = "TF";
  }
  const year = fiscalYear || fiscalYearFromPrNumber(prNumber) || new Date().getFullYear();
  const yy = String(year).slice(-2);
  const normalized = normalizePrNumber(prNumber);
  const parts = normalized.split("-");
  const seq = parts[parts.length - 1] || "";
  return `${fundPrefix}-${yy}-${seq}`;
}

export function fiscalYearFromPrNumber(prNumber: string): number | null {
  if (!prNumber) return null;
  const trimmed = prNumber.trim();
  const match = trimmed.match(/^(\d{2})-/);
  if (match) {
    const yy = parseInt(match[1], 10);
    if (!isNaN(yy)) {
      return 2000 + yy;
    }
  }
  return null;
}

export const ROLES = {
  ADMIN: "ADMIN",
  BAC_SECRETARIAT: "BAC_SECRETARIAT",
  END_USER: "END_USER",

} as const;

export type Role = keyof typeof ROLES;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "System Administrator",
  BAC_SECRETARIAT: "BAC Secretariat",
  END_USER: "End User (BAC Secretariat Staff)",
};

export const PR_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Signing",
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
  mayorRole: "Municipal Mayor",
} as const;

// Extremely basic number to words for the PO. Max 99,999,999 for simplicity.
export function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  const toWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? "-" + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + toWords(n % 100) : "");
    if (n < 1000000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + toWords(n % 1000) : "");
    if (n < 1000000000) return toWords(Math.floor(n / 1000000)) + " Million" + (n % 1000000 !== 0 ? " " + toWords(n % 1000000) : "");
    return String(n);
  };
  
  const dollars = Math.floor(num);
  const cents = Math.round((num - dollars) * 100);
  
  let str = toWords(dollars) + " Pesos";
  if (cents > 0) {
    str += " and " + cents + "/100";
  }
  return str + " Only";
}
