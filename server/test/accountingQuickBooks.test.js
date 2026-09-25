import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailySalesPayload,
  buildBillPayload,
  enumerateDates,
  payMethodLabel,
  qboQueryLiteral,
  round2,
  toISODate,
} from '../src/services/accountingQuickBooks.js';

const DATE = '2026-09-26';

const sum = (lines) => round2(lines.reduce((s, l) => s + Number(l.Amount || 0), 0));

// ─── Daily sales summary → Invoice ───────────────────────────────────────────
test('daily sales: returns null with no orders', () => {
  assert.equal(buildDailySalesPayload({ date: DATE, orders: [] }), null);
  assert.equal(buildDailySalesPayload({ date: DATE }), null);
});

test('daily sales: one line per pay method, net of tax', () => {
  const p = buildDailySalesPayload({
    date: DATE,
    orders: [
      { pay_method: 'cash', subtotal: 100, tax: 12, total: 112 },
      { pay_method: 'cash', subtotal: 50, tax: 6, total: 56 },
      { pay_method: 'card', subtotal: 200, tax: 24, total: 224 },
      { pay_method: 'ewallet', subtotal: 30, tax: 3.6, total: 33.6 },
    ],
  });
  const descriptions = p.Line.map(l => l.Description);
  assert.equal(descriptions.filter(d => d.startsWith('Cash')).length, 1);
  assert.ok(descriptions.some(d => d.startsWith('Card')));
  assert.ok(descriptions.some(d => d.startsWith('E-wallet')));

  const cash = p.Line.find(l => l.Description.startsWith('Cash'));
  assert.equal(cash.Amount, 150);
  assert.ok(cash.Description.includes('4 orders'));

  // Line items must sum to the day's gross total (net + tax), or QBO will
  // silently disagree with the Z-Report.
  assert.equal(sum(p.Line), 425.6);
});

test('daily sales: adds tax line only when tax > 0', () => {
  const withTax = buildDailySalesPayload({
    date: DATE,
    orders: [{ pay_method: 'cash', subtotal: 100, tax: 12, total: 112 }],
  });
  assert.ok(withTax.Line.some(l => l.Description === 'Sales tax / VAT'));
  assert.equal(withTax.Line.find(l => l.Description === 'Sales tax / VAT').Amount, 12);

  const noTax = buildDailySalesPayload({
    date: DATE,
    orders: [{ pay_method: 'cash', subtotal: 100, tax: 0, total: 100 }],
  });
  assert.ok(!noTax.Line.some(l => l.Description === 'Sales tax / VAT'));
  assert.equal(sum(noTax.Line), 100);
});

test('daily sales: tax-only rounding stays exact', () => {
  const p = buildDailySalesPayload({
    date: DATE,
    orders: [
      { pay_method: 'cash', subtotal: 33.33, tax: 3.33, total: 36.66 },
      { pay_method: 'cash', subtotal: 33.33, tax: 3.33, total: 36.66 },
      { pay_method: 'cash', subtotal: 33.34, tax: 3.34, total: 36.68 },
    ],
  });
  // Net 100.00 + tax 10.00 — float accumulation must not drift.
  assert.equal(sum(p.Line), 110);
});

test('daily sales: DocNumber + TxnDate are stable per day (idempotent doc)', () => {
  const p = buildDailySalesPayload({
    date: DATE,
    orders: [{ pay_method: 'cash', subtotal: 10, tax: 0, total: 10 }],
  });
  assert.equal(p.DocNumber, 'ERL-20260926');
  assert.equal(p.TxnDate, DATE);
  assert.equal(p.CustomerRef.name, 'Walk-in Sales');
});

test('daily sales: PrivateNote carries the Z-Report style breakdown', () => {
  const p = buildDailySalesPayload({
    date: DATE,
    orders: [
      { pay_method: 'cash', subtotal: 100, tax: 12, total: 112 },
      { pay_method: 'card', subtotal: 50, tax: 6, total: 56 },
    ],
  });
  assert.match(p.PrivateNote, /Orders: 2/);
  assert.match(p.PrivateNote, /Net sales: 150\.00/);
  assert.match(p.PrivateNote, /Tax: 18\.00/);
  assert.match(p.PrivateNote, /Gross total: 168\.00/);
  assert.match(p.PrivateNote, /Cash 100\.00/);
  assert.match(p.PrivateNote, /Card 50\.00/);
});

test('daily sales: unknown pay_method gets a readable label', () => {
  const p = buildDailySalesPayload({
    date: DATE,
    orders: [{ pay_method: 'gcash', subtotal: 25, tax: 0, total: 25 }],
  });
  assert.equal(p.Line[0].Description, 'Gcash sales (1 order)');
  assert.equal(payMethodLabel(undefined), 'Other');
  assert.equal(payMethodLabel('E-WALLET'), 'E-wallet');
});

// ─── Supplier invoice → Bill ─────────────────────────────────────────────────
const SUPPLIER_INVOICE = {
  id: 7,
  invoice_number: 'SI-0042',
  supplier_name: 'Beans R Us',
  invoice_date: '2026-09-20',
  due_date: '2026-10-20',
  subtotal: 900,
  tax_amount: 100,
  total_amount: 1000,
};

test('bill: one line per supplier invoice item', () => {
  const p = buildBillPayload({
    invoice: SUPPLIER_INVOICE,
    items: [
      { item_description: 'Arabica beans 1kg', quantity: 10, unit_price: 80, total_price: 800 },
      { item_description: 'Oat milk 1L', quantity: 20, unit_price: 5, total_price: 100 },
    ],
  });
  assert.equal(p.Line.length, 2);
  assert.equal(p.Line[0].Description, 'Arabica beans 1kg');
  assert.equal(p.Line[0].Quantity, 10);
  assert.equal(p.Line[0].DetailType, 'AccountBasedExpenseLineDetail');
  assert.equal(sum(p.Line), 900);
  assert.equal(p.VendorRef.name, 'Beans R Us');
  assert.equal(p.TxnDate, '2026-09-20');
  assert.equal(p.DueDate, '2026-10-20');
  assert.equal(p.DocNumber, 'SI-0042');
  assert.equal(p.TxnTaxDetail.TotalTax, 100);
});

test('bill: falls back to a single line when no items recorded', () => {
  const p = buildBillPayload({ invoice: SUPPLIER_INVOICE, items: [] });
  assert.equal(p.Line.length, 1);
  assert.equal(sum(p.Line), 1000);
});

test('bill: zero-value lines are dropped', () => {
  const p = buildBillPayload({
    invoice: SUPPLIER_INVOICE,
    items: [
      { item_description: 'Real', quantity: 1, total_price: 100 },
      { item_description: 'Freebie', quantity: 1, total_price: 0 },
    ],
  });
  assert.equal(p.Line.length, 1);
});

test('bill: returns null without a usable total', () => {
  assert.equal(buildBillPayload({ invoice: null }), null);
  assert.equal(buildBillPayload({ invoice: { total_amount: 'n/a' } }), null);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
test('enumerateDates is inclusive and validates input', () => {
  assert.deepEqual(enumerateDates('2026-09-01', '2026-09-03'), [
    '2026-09-01', '2026-09-02', '2026-09-03',
  ]);
  assert.equal(enumerateDates('2026-09-01', '2026-09-01').length, 1);
  assert.throws(() => enumerateDates('2026-09-03', '2026-09-01'), /before start/);
  assert.throws(() => enumerateDates('nope', '2026-09-01'), /YYYY-MM-DD/);
  assert.throws(() => enumerateDates('2026-01-01', '2026-12-31'), /Range too large/);
});

test('toISODate and round2 behave', () => {
  assert.equal(toISODate(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(round2(10.239), 10.24);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('qboQueryLiteral escapes single quotes', () => {
  assert.equal(qboQueryLiteral("O'Brien"), "'O\\'Brien'");
  assert.equal(qboQueryLiteral('Plain'), "'Plain'");
});
