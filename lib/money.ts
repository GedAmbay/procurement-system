/**
 * Shared Money and Bid Math Engine for LGU Procurement
 *
 * Rules:
 * 1. Store only unit prices per line item.
 * 2. Never store or trust an independently stored total. Derive on read.
 * 3. All monetary calculations are computed using integer centavos to avoid float rounding errors.
 * 4. formatPeso() is the single source of truth for peso formatting.
 */

export type QuotationStatus = "PENDING" | "RETURNED" | "NO_BID";

/**
 * Converts a peso value (float or number) to integer centavos (e.g. 1500.50 -> 150050)
 */
export function toCentavos(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === "") return 0;
  const num = typeof amount === "string" ? parseFloat(amount.replace(/,/g, "").trim()) : amount;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts integer centavos back to floating-point pesos (e.g. 150050 -> 1500.50)
 */
export function fromCentavos(centavos: number): number {
  if (!centavos || isNaN(centavos)) return 0;
  return centavos / 100;
}

/**
 * Formats a peso amount to standard Philippine Peso currency representation (e.g., ₱1,500.00).
 */
export function formatPeso(
  amount: number | null | undefined,
  options?: { showZeroAsDash?: boolean; showSign?: boolean }
): string {
  if (amount === null || amount === undefined) {
    return options?.showZeroAsDash ? "—" : "₱0.00";
  }

  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return options?.showZeroAsDash ? "—" : "₱0.00";

  if (num === 0 && options?.showZeroAsDash) return "—";

  const isNegative = num < 0;
  const absFormatted = Math.abs(num).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (options?.showSign) {
    if (isNegative) return `-₱${absFormatted}`;
    if (num > 0) return `+₱${absFormatted}`;
    return `₱${absFormatted}`;
  }

  return isNegative ? `-₱${absFormatted}` : `₱${absFormatted}`;
}

export interface LineItemPricing {
  id?: string;
  rfqLineItemId: string;
  description: string;
  unit: string;
  quantity: number;
  abcUnitCost: number; // in pesos
  unitPrice: number;   // in pesos
}

export interface ComputedLineItem extends LineItemPricing {
  abcUnitCostCentavos: number;
  unitPriceCentavos: number;
  totalCostCentavos: number;
  totalCost: number;
  abcTotalCostCentavos: number;
  abcTotalCost: number;
  varianceCentavos: number; // totalCostCentavos - abcTotalCostCentavos
  variancePesos: number;
  isOverAbc: boolean;
  vsAbcPercent: number;
}

export interface QuotationDerivedSummary {
  quotationId: string;
  supplierId: string;
  supplierName: string;
  status: QuotationStatus;
  submittedAt: string | null;
  totalBidCentavos: number;
  totalBid: number;
  totalAbcCentavos: number;
  totalAbc: number;
  varianceCentavos: number; // totalBidCentavos - totalAbcCentavos
  variancePesos: number;
  isOverBudget: boolean;
  isUnderBudget: boolean;
  percentVariance: number; // e.g. 6.13%
  computedLineItems: ComputedLineItem[];
}

/**
 * Computes derived totals and variances for a single quotation given the RFQ line items.
 */
export function computeQuotationSummary(
  quotation: {
    id: string;
    supplierId: string;
    supplier?: { name: string };
    status?: string;
    submittedAt?: Date | string | null;
    lineItems?: Array<{
      id?: string;
      rfqLineItemId: string;
      unitPrice: number;
      totalPrice?: number;
    }>;
  },
  rfqLineItems: Array<{
    id: string;
    description: string;
    unit: string;
    quantity: number;
    unitCost: number; // ABC per unit
    totalCost?: number;
  }>
): QuotationDerivedSummary {
  let totalBidCentavos = 0;
  let totalAbcCentavos = 0;

  const rawStatus = (quotation.status || "").toUpperCase();
  const status: QuotationStatus =
    rawStatus === "NO_BID" ? "NO_BID" : rawStatus === "RETURNED" ? "RETURNED" : "PENDING";

  const submittedAt = quotation.submittedAt
    ? new Date(quotation.submittedAt).toISOString()
    : null;

  const quoteLineMap = new Map<string, { id?: string; unitPrice: number }>();
  for (const qli of quotation.lineItems || []) {
    quoteLineMap.set(qli.rfqLineItemId, {
      id: qli.id,
      unitPrice: Number(qli.unitPrice) || 0,
    });
  }

  const computedLineItems: ComputedLineItem[] = rfqLineItems.map((rfqItem) => {
    const qty = Number(rfqItem.quantity) || 0;
    const abcUnitCost = Number(rfqItem.unitCost) || 0;
    const abcUnitCostCentavos = toCentavos(abcUnitCost);
    const abcTotalCostCentavos = Math.round(qty * abcUnitCostCentavos);

    const match = quoteLineMap.get(rfqItem.id);
    const unitPrice = status === "NO_BID" ? 0 : (match?.unitPrice || 0);
    const unitPriceCentavos = toCentavos(unitPrice);
    const totalCostCentavos = Math.round(qty * unitPriceCentavos);

    totalBidCentavos += totalCostCentavos;
    totalAbcCentavos += abcTotalCostCentavos;

    const lineVarianceCentavos = totalCostCentavos - abcTotalCostCentavos;
    const vsAbcPercent =
      abcTotalCostCentavos > 0
        ? Math.abs(lineVarianceCentavos) / abcTotalCostCentavos * 100
        : 0;

    return {
      id: match?.id,
      rfqLineItemId: rfqItem.id,
      description: rfqItem.description,
      unit: rfqItem.unit,
      quantity: qty,
      abcUnitCost,
      abcUnitCostCentavos,
      abcTotalCost: fromCentavos(abcTotalCostCentavos),
      abcTotalCostCentavos,
      unitPrice,
      unitPriceCentavos,
      totalCost: fromCentavos(totalCostCentavos),
      totalCostCentavos,
      varianceCentavos: lineVarianceCentavos,
      variancePesos: fromCentavos(lineVarianceCentavos),
      isOverAbc: lineVarianceCentavos > 0 && unitPriceCentavos > 0,
      vsAbcPercent,
    };
  });

  const varianceCentavos = totalBidCentavos - totalAbcCentavos;
  const percentVariance =
    totalAbcCentavos > 0
      ? (Math.abs(varianceCentavos) / totalAbcCentavos) * 100
      : 0;

  return {
    quotationId: quotation.id,
    supplierId: quotation.supplierId,
    supplierName: quotation.supplier?.name || "Supplier",
    status,
    submittedAt,
    totalBidCentavos,
    totalBid: fromCentavos(totalBidCentavos),
    totalAbcCentavos,
    totalAbc: fromCentavos(totalAbcCentavos),
    varianceCentavos,
    variancePesos: fromCentavos(varianceCentavos),
    isOverBudget: varianceCentavos > 0 && totalBidCentavos > 0,
    isUnderBudget: varianceCentavos < 0 && totalBidCentavos > 0,
    percentVariance,
    computedLineItems,
  };
}

export interface AbstractEvaluationResult {
  totalSuppliers: number;
  returnedCount: number;
  pendingCount: number;
  noBidCount: number;
  isAllAccountedFor: boolean; // all returned or no_bid (0 pending)
  isProvisional: boolean;     // true if not all accounted for
  totalAbc: number;
  lowestBidder: QuotationDerivedSummary | null;
  summaries: QuotationDerivedSummary[];
  warningMessages: string[];
}

/**
 * Evaluates all bids for an Abstract and identifies the lowest valid bidder.
 * Rule: Only RETURNED bids count. Marked provisional until every supplier is accounted for.
 */
export function evaluateAbstractBids(
  quotations: Array<any>,
  rfqLineItems: Array<any>
): AbstractEvaluationResult {
  const summaries: QuotationDerivedSummary[] = quotations.map((q) =>
    computeQuotationSummary(q, rfqLineItems)
  );

  const totalSuppliers = summaries.length;
  const returned = summaries.filter((s) => s.status === "RETURNED");
  const pending = summaries.filter((s) => s.status === "PENDING");
  const noBid = summaries.filter((s) => s.status === "NO_BID");

  const returnedCount = returned.length;
  const pendingCount = pending.length;
  const noBidCount = noBid.length;

  const isAllAccountedFor = totalSuppliers >= 3 && pendingCount === 0;
  const isProvisional = !isAllAccountedFor;

  // Filter candidates for lowest bid: Must be RETURNED with positive total
  const validReturnedBids = returned.filter((s) => s.totalBidCentavos > 0);

  let lowestBidder: QuotationDerivedSummary | null = null;
  if (validReturnedBids.length > 0) {
    lowestBidder = validReturnedBids.reduce((prev, curr) => {
      if (curr.totalBidCentavos < prev.totalBidCentavos) return curr;
      if (curr.totalBidCentavos === prev.totalBidCentavos) {
        // Tie-breaker: earlier date received
        const prevDate = prev.submittedAt ? new Date(prev.submittedAt).getTime() : Infinity;
        const currDate = curr.submittedAt ? new Date(curr.submittedAt).getTime() : Infinity;
        return currDate < prevDate ? curr : prev;
      }
      return prev;
    });
  }

  // Derive total ABC from the first summary, or fallback to sum of rfqLineItems
  const totalAbcCentavos = rfqLineItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.unitCost) || 0;
    return sum + Math.round(qty * toCentavos(cost));
  }, 0);
  const totalAbc = fromCentavos(totalAbcCentavos);

  // Warning conditions
  const warningMessages: string[] = [];
  if (pendingCount > 0) {
    const pendingNames = pending.map((p) => p.supplierName).join(", ");
    warningMessages.push(
      `The ranking is provisional. ${pendingNames} ${
        pending.length === 1 ? "has" : "have"
      } not returned their quotations, so the lowest bid can still change.`
    );
  }

  const missingDates = returned.filter((r) => !r.submittedAt);
  if (missingDates.length > 0) {
    const missingNames = missingDates.map((m) => m.supplierName).join(", ");
    warningMessages.push(`${missingNames} is missing a received date.`);
  }

  return {
    totalSuppliers,
    returnedCount,
    pendingCount,
    noBidCount,
    isAllAccountedFor,
    isProvisional,
    totalAbc,
    lowestBidder,
    summaries,
    warningMessages,
  };
}

export interface FinalizeEligibility {
  canFinalize: boolean;
  disabledReason?: string;
  checklist: {
    minSuppliersMet: boolean;
    allReturnedOrNoBid: boolean;
    hasValidWinner: boolean;
    allDatesPresent: boolean;
    winnerWithinBudget: boolean;
  };
  pendingSuppliers: string[];
  missingDateSuppliers: string[];
}

/**
 * Validates whether an Abstract of Canvass can be finalized.
 * Server and Client use this exact function as the single source of truth.
 */
export function checkFinalizeEligibility(
  quotations: Array<any>,
  rfqLineItems: Array<any>
): FinalizeEligibility {
  const evalResult = evaluateAbstractBids(quotations, rfqLineItems);

  const minSuppliersMet = evalResult.totalSuppliers >= 3;
  const allReturnedOrNoBid = evalResult.pendingCount === 0;
  const hasValidWinner = evalResult.lowestBidder !== null;
  const missingDateSuppliers = evalResult.summaries
    .filter((s) => s.status === "RETURNED" && !s.submittedAt)
    .map((s) => s.supplierName);
  const allDatesPresent = missingDateSuppliers.length === 0;

  const winnerWithinBudget = evalResult.lowestBidder
    ? evalResult.lowestBidder.totalBidCentavos <= toCentavos(evalResult.totalAbc)
    : false;

  const pendingSuppliers = evalResult.summaries
    .filter((s) => s.status === "PENDING")
    .map((s) => s.supplierName);

  const canFinalize =
    minSuppliersMet &&
    allReturnedOrNoBid &&
    hasValidWinner &&
    allDatesPresent &&
    winnerWithinBudget;

  let disabledReason: string | undefined;
  if (!minSuppliersMet) {
    disabledReason = `Requires at least 3 suppliers (${evalResult.totalSuppliers} added so far).`;
  } else if (!allReturnedOrNoBid) {
    disabledReason = `Available once all ${evalResult.totalSuppliers} quotations are returned or marked no-bid (${evalResult.returnedCount} of ${evalResult.totalSuppliers} returned so far).`;
  } else if (!allDatesPresent) {
    disabledReason = `Missing received date for: ${missingDateSuppliers.join(", ")}.`;
  } else if (!hasValidWinner) {
    disabledReason = "No valid supplier bid has been recorded.";
  } else if (!winnerWithinBudget) {
    disabledReason = "Lowest bid exceeds the Approved Budget for the Contract (ABC).";
  }

  return {
    canFinalize,
    disabledReason,
    checklist: {
      minSuppliersMet,
      allReturnedOrNoBid,
      hasValidWinner,
      allDatesPresent,
      winnerWithinBudget,
    },
    pendingSuppliers,
    missingDateSuppliers,
  };
}

