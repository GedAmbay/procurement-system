const assert = require("node:assert");
const test = require("node:test");

// Inline pure functions from money.ts to verify directly in Node
function toCentavos(amount) {
  if (amount === null || amount === undefined || amount === "") return 0;
  const num = typeof amount === "string" ? parseFloat(amount.replace(/,/g, "").trim()) : amount;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function fromCentavos(centavos) {
  if (!centavos || isNaN(centavos)) return 0;
  return centavos / 100;
}

function formatPeso(amount, options) {
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

test("Money Math: toCentavos and fromCentavos avoid float precision errors", () => {
  assert.strictEqual(toCentavos(1500.5), 150050);
  assert.strictEqual(toCentavos("1,500.00"), 150000);
  assert.strictEqual(toCentavos("120.00"), 12000);
  assert.strictEqual(fromCentavos(150050), 1500.5);
  // Verify 0.1 + 0.2 doesn't produce 0.30000000000000004
  const sumCentavos = toCentavos(0.1) + toCentavos(0.2);
  assert.strictEqual(sumCentavos, 30);
  assert.strictEqual(fromCentavos(sumCentavos), 0.3);
});

test("formatPeso formatting", () => {
  assert.strictEqual(formatPeso(1500), "₱1,500.00");
  assert.strictEqual(formatPeso(1598), "₱1,598.00");
  assert.strictEqual(formatPeso(-98, { showSign: true }), "-₱98.00");
  assert.strictEqual(formatPeso(98, { showSign: true }), "+₱98.00");
  assert.strictEqual(formatPeso(0, { showZeroAsDash: true }), "—");
});

test("Derived bid calculation matches mock design exactly (₱1,500 vs ₱1,598)", () => {
  const rfqLineItems = [
    { id: "1", description: "Toner Cartridge", quantity: 1, unitCost: 120.00 },
    { id: "2", description: "Stapler Heavy Duty", quantity: 1, unitCost: 250.00 },
    { id: "3", description: "Ballpoint Pen", quantity: 4, unitCost: 307.00 },
  ];

  // ABC total = 1*120 + 1*250 + 4*307 = 120 + 250 + 1228 = 1,598.00
  const totalAbcCentavos = rfqLineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * toCentavos(item.unitCost)),
    0
  );
  assert.strictEqual(fromCentavos(totalAbcCentavos), 1598.00);

  // Supplier bid: 1*100 + 1*200 + 4*300 = 100 + 200 + 1200 = 1,500.00
  const supplierUnitPrices = { "1": 100.00, "2": 200.00, "3": 300.00 };
  const totalBidCentavos = rfqLineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * toCentavos(supplierUnitPrices[item.id])),
    0
  );
  assert.strictEqual(fromCentavos(totalBidCentavos), 1500.00);

  const varianceCentavos = totalBidCentavos - totalAbcCentavos;
  assert.strictEqual(fromCentavos(varianceCentavos), -98.00);
  assert.strictEqual(formatPeso(Math.abs(fromCentavos(varianceCentavos))), "₱98.00");
});

