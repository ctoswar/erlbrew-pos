import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailySalesInvoice,
  buildBill,
  reconcileBankFeed,
  generateMockStatementFeed,
  reconcileBankStatements,
  xeroRequest,
  forceDryRun,
  isLive,
  getConnectionState as getXeroConnectionState,
} from '../src/services/accountingXero.js';
import { getConnectionState as getQuickBooksConnectionState } from '../src/services/accountingQuickBooks.js';

const DATE = '2026-09-26';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const sum = (lines) => r2(lines.reduce((s, l) => s + Number(l.LineAmount || 0), 0));

// ─── Daily sales summary → Xero ACCREC invoice ──────────────────────────────
test('daily sales invoice: returns null with no orders', () => {
  assert.equal(buildDailySalesInvoice([], DATE), null);
  assert.equal(buildDailySalesInvoice(undefined, DATE), null);
});

test('daily sales invoice: one line per pay method, net of tax', () => {
  const p = buildDailySalesInvoice(
    [
      { pay_method: 'cash', subtotal: 100, tax: 12, total: 112 },
      { pay_method: 'cash', subtotal: 50, tax: 6, total: 56 },
      { pay_method: 'card', subtotal: 200, tax: 24, total: 224 },
      { pay_method: 'ewallet', subtotal: 30, tax: 3.6, total: 33.6 },
    ],
    DATE
  );
  const descriptions = p.Line.map((l) => l.Description);
  assert.equal(descriptions.filter((d) => d.startsWith('Cash')).length, 1);
  assert.ok(descriptions.some((d) => d.startsWith('Card')));
  assert.ok(descriptions.some((d) => d.startsWith('E-wallet')));

  const cash = p.Line.find((l) => l.Description.startsWith('Cash'));
  assert.equal(cash.LineAmount, 150);
  assert.ok(cash.Description.includes('4 orders'));

  // Lines (net + tax line) must sum to the day's gross total or Xero will
  // silently disagree with the Z-Report.
  assert.equal(sum(p.Line), 425.6);
  assert.equal(p.Total, 425.6);
});

test('daily sales invoice: adds tax line only when tax > 0', () => {
  const withTax = buildDailySalesInvoice(
    [{ pay_method: 'cash', subtotal: 100, tax: 12, total: 112 }],
    DATE
  );
  assert.ok(withTax.Line.some((l) => l.Description === 'Sales tax / VAT'));
  assert.equal(withTax.Line.find((l) => l.Description === 'Sales tax / VAT').LineAmount, 12);

  const noTax = buildDailySalesInvoice(
    [{ pay_method: 'cash', subtotal: 100, tax: 0, total: 100 }],
    DATE
  );
  assert.ok(!noTax.Line.some((l) => l.Description === 'Sales tax / VAT'));
  assert.equal(sum(noTax.Line), 100);
  assert.equal(noTax.TotalTax, 0);
});

test('daily sales invoice: tax-only rounding stays exact', () => {
  const p = buildDailySalesInvoice(
    [
      { pay_method: 'cash', subtotal: 33.33, tax: 3.33, total: 36.66 },
      { pay_method: 'cash', subtotal: 33.33, tax: 3.33, total: 36.66 },
      { pay_method: 'cash', subtotal: 33.34, tax: 3.34, total: 36.68 },
    ],
    DATE
  );
  // Net 100.00 + tax 10.00 — float accumulation must not drift.
  assert.equal(sum(p.Line), 110);
  assert.equal(p.SubTotal, 100);
  assert.equal(p.TotalTax, 10);
  assert.equal(p.Total, 110);
});

test('daily sales invoice: DocNumber/Date/Type are stable per day', () => {
  const p = buildDailySalesInvoice(
    [{ pay_method: 'cash', subtotal: 10, tax: 0, total: 10 }],
    DATE
  );
  assert.equal(p.DocNumber, 'ERL-20260926');
  assert.equal(p.Date, DATE);
  assert.equal(p.DueDate, DATE);
  assert.equal(p.Type, 'ACCREC');
  assert.equal(p.Status, 'AUTHORISED');
  assert.equal(p.LineAmountType, 'Exclusive');
  assert.equal(p.Contact.Name, 'Walk-in Sales');
  assert.match(p.Reference, /Erlbrew POS 2026-09-26/);
});

test('daily sales invoice: unknown pay_method gets a readable label', () => {
  const p = buildDailySalesInvoice(
    [{ pay_method: 'gcash', subtotal: 25, tax: 0, total: 25 }],
    DATE
  );
  assert.equal(p.Line[0].Description, 'Gcash sales (1 order)');
});

// ─── Supplier invoice → Xero ACCPAY bill ────────────────────────────────────
const SUPPLIER_INVOICE = {
  id: 7,
  invoice_number: 'SI-0042',
  supplier_name: 'Beans R Us',
  invoice_date: '2026-09-20',
  due_date: '2026-10-20',
  subtotal: 900,
  tax_amount: 100,
  total_amount: 1000,
  status: 'pending',
};

test('bill: one line per supplier invoice item, totals carried', () => {
  const p = buildBill(SUPPLIER_INVOICE, [
    { item_description: 'Arabica beans 1kg', quantity: 10, unit_price: 80, total_price: 800 },
    { item_description: 'Oat milk 1L', quantity: 20, unit_price: 5, total_price: 100 },
  ]);
  assert.equal(p.Line.length, 2);
  assert.equal(p.Line[0].Description, 'Arabica beans 1kg');
  assert.equal(p.Line[0].Quantity, 10);
  assert.equal(p.Line[0].UnitAmount, 80);
  assert.equal(sum(p.Line), 900);
  assert.equal(p.Type, 'ACCPAY');
  assert.equal(p.Contact.Name, 'Beans R Us');
  assert.equal(p.Date, '2026-09-20');
  assert.equal(p.DueDate, '2026-10-20');
  assert.equal(p.DocNumber, 'SI-0042');
  assert.equal(p.SubTotal, 900);
  assert.equal(p.TotalTax, 100);
  assert.equal(p.Total, 1000);
});

test('bill: cancelled invoices never map', () => {
  assert.equal(buildBill({ ...SUPPLIER_INVOICE, status: 'cancelled' }, [
    { item_description: 'Beans', quantity: 1, total_price: 100 },
  ]), null);
  assert.equal(buildBill({ ...SUPPLIER_INVOICE, status: 'CANCELLED' }), null);
});

test('bill: falls back to a single line when no items recorded', () => {
  const p = buildBill(SUPPLIER_INVOICE, []);
  assert.equal(p.Line.length, 1);
  assert.equal(sum(p.Line), 1000);
  assert.equal(p.Total, 1000);
});

test('bill: zero-value lines are dropped', () => {
  const p = buildBill(SUPPLIER_INVOICE, [
    { item_description: 'Real', quantity: 1, total_price: 100 },
    { item_description: 'Freebie', quantity: 1, total_price: 0 },
  ]);
  assert.equal(p.Line.length, 1);
});

test('bill: returns null without a usable total', () => {
  assert.equal(buildBill(null), null);
  assert.equal(buildBill({ total_amount: 'n/a' }), null);
});

// ─── Bank reconciliation engine ─────────────────────────────────────────────
test('reconcile: exact amount + date match wins outright', () => {
  const recorded = [
    { id: 1, date: DATE, amount: 112, description: 'Cash drawer sale', orderId: 'ord-1', drawerTransactionId: 1 },
    { id: 2, date: DATE, amount: 224, description: 'Cash drawer sale', drawerTransactionId: 2 },
  ];
  const statement = [{ id: 'S1', date: DATE, amount: 112, description: 'Deposit 1' }];

  const r = reconcileBankFeed({ transactions: recorded, statementLines: statement });
  assert.equal(r.matched, 1);
  assert.equal(r.unmatched, 1);
  assert.equal(r.variance, 0);

  const [line, leftover] = r.results;
  assert.equal(line.status, 'matched');
  assert.equal(line.reason, 'exact match: same amount and date');
  assert.equal(line.amount, 112);
  assert.equal(line.description, 'Deposit 1');
  assert.equal(line.orderId, 'ord-1');
  assert.equal(line.drawerTransactionId, 1);
  assert.equal(leftover.status, 'unmatched');
  assert.equal(leftover.drawerTransactionId, 2);
  assert.match(leftover.reason, /no statement line/);
});

test('reconcile: exact duplicates pick the lowest recorded id', () => {
  const recorded = [
    { id: 7, date: DATE, amount: 50, drawerTransactionId: 7 },
    { id: 2, date: DATE, amount: 50, drawerTransactionId: 2 },
  ];
  const statement = [{ id: 'S1', date: DATE, amount: 50 }];
  const r = reconcileBankFeed({ transactions: recorded, statementLines: statement });
  assert.equal(r.matched, 1);
  assert.equal(r.results[0].drawerTransactionId, 2);
});

test('reconcile: tolerance match reports amount and date deltas', () => {
  const recorded = [{ id: 1, date: DATE, amount: 112, orderId: 'ord_abc', drawerTransactionId: 1 }];
  const statement = [{ id: 'S1', date: '2026-09-27', amount: 111.99, description: 'Settled deposit' }];

  const r = reconcileBankFeed({
    transactions: recorded,
    statementLines: statement,
    toleranceCents: 5,
    dateWindowDays: 1,
  });
  assert.equal(r.matched, 1);
  assert.equal(r.unmatched, 0);
  assert.equal(r.results[0].status, 'matched');
  assert.equal(
    r.results[0].reason,
    'tolerance match: amount within 1 cent(s), date within 1 day(s)'
  );
  assert.equal(r.results[0].orderId, 'ord_abc');
  // 112.00 recorded − 111.99 statement
  assert.equal(r.variance, 0.01);
});

test('reconcile: tolerance candidates pick nearest date then lowest id', () => {
  const recorded = [
    { id: 5, date: '2026-09-26', amount: 100, drawerTransactionId: 5 },
    { id: 3, date: '2026-09-28', amount: 100, drawerTransactionId: 3 },
  ];
  const statement = [
    { id: 'S1', date: '2026-09-27', amount: 100 },
    { id: 'S2', date: '2026-09-27', amount: 100 },
  ];

  const r = reconcileBankFeed({
    transactions: recorded,
    statementLines: statement,
    toleranceCents: 0,
    dateWindowDays: 2,
  });
  assert.equal(r.matched, 2);
  assert.equal(r.unmatched, 0);
  // Both candidates are 1 day away → lowest id (3) is taken first.
  assert.equal(r.results[0].drawerTransactionId, 3);
  assert.equal(r.results[1].drawerTransactionId, 5);
  assert.match(r.results[0].reason, /date within 1 day/);
});

test('reconcile: variance = matched recorded − matched statement', () => {
  const recorded = [
    { id: 1, date: DATE, amount: 100, drawerTransactionId: 1 },
    { id: 2, date: DATE, amount: 50, drawerTransactionId: 2 }, // never on the statement
    { id: 3, date: '2026-09-27', amount: 200, drawerTransactionId: 3 },
  ];
  const statement = [
    { id: 'S1', date: DATE, amount: 100 },
    { id: 'S2', date: DATE, amount: 199.5 },
  ];

  const r = reconcileBankFeed({
    transactions: recorded,
    statementLines: statement,
    toleranceCents: 100,
    dateWindowDays: 1,
  });
  assert.equal(r.matched, 2);
  assert.equal(r.unmatched, 1); // the 50 recorded sale
  // (100 + 200) − (100 + 199.50)
  assert.equal(r.variance, 0.5);
  assert.equal(r.summary.matchedRecordedTotal, 300);
  assert.equal(r.summary.matchedStatementTotal, 299.5);
  assert.equal(r.summary.unmatchedRecorded, 1);
  assert.equal(r.summary.unmatchedStatement, 0);

  const tail = r.results[2];
  assert.equal(tail.status, 'unmatched');
  assert.equal(tail.amount, 50);
  assert.equal(tail.drawerTransactionId, 2);
});

test('reconcile: nothing outside the tolerance/window is matched', () => {
  const recorded = [{ id: 1, date: DATE, amount: 100 }];
  const statement = [{ id: 'S1', date: '2026-09-26', amount: 105 }];
  const r = reconcileBankFeed({ transactions: recorded, statementLines: statement });
  assert.equal(r.matched, 0);
  assert.equal(r.unmatched, 2);
  assert.equal(r.variance, 0);
  assert.match(r.results[0].reason, /no recorded transaction/);
});

test('reconcile: empty inputs are harmless', () => {
  assert.deepEqual(reconcileBankFeed(), {
    matched: 0,
    unmatched: 0,
    variance: 0,
    results: [],
    summary: {
      toleranceCents: 0,
      dateWindowDays: 0,
      recordedCount: 0,
      statementCount: 0,
      matchedCount: 0,
      unmatchedStatement: 0,
      unmatchedRecorded: 0,
      recordedTotal: 0,
      statementTotal: 0,
      matchedRecordedTotal: 0,
      matchedStatementTotal: 0,
    },
  });
  assert.equal(reconcileBankFeed({ transactions: [], statementLines: [] }).unmatched, 0);
});

// ─── Mock statement feed (dry-run, zero credentials) ────────────────────────
const RECORDED_FIXTURE = [
  { id: 1, date: DATE, amount: 112, orderId: 'ord-1', drawerTransactionId: 1, description: 'Cash drawer sale' },
  { id: 2, date: DATE, amount: 224, drawerTransactionId: 2, description: 'Cash drawer sale' },
  { id: 3, date: '2026-09-27', amount: 56.5, drawerTransactionId: 3, description: 'Cash drawer sale' },
];

test('mock statement feed: deterministic, seeded by the date range', () => {
  const args = { transactions: RECORDED_FIXTURE, start: DATE, end: '2026-09-27' };
  const feed1 = generateMockStatementFeed(args);
  const feed2 = generateMockStatementFeed(args);
  assert.deepEqual(feed1, feed2); // identical inputs → identical output
  assert.equal(feed1.length, 3);
  assert.match(feed1[0].id, /^MOCK-2026-09-26\.\.2026-09-27-1$/);
  assert.match(feed1[0].description, /2026-09-26\.\.2026-09-27/);
  assert.equal(feed1[0].amount, 112);
  // Out-of-range rows are filtered out.
  assert.equal(generateMockStatementFeed({ transactions: RECORDED_FIXTURE, start: '2026-09-27', end: '2026-09-27' }).length, 1);
});

test('mock statement feed: reconciles cleanly against its own recorded data', () => {
  const feed = generateMockStatementFeed({ transactions: RECORDED_FIXTURE, start: DATE, end: '2026-09-27' });
  const r = reconcileBankFeed({ transactions: RECORDED_FIXTURE, statementLines: feed });
  assert.equal(r.matched, 3);
  assert.equal(r.unmatched, 0);
  assert.equal(r.variance, 0);
  assert.ok(r.results.every((line) => line.status === 'matched'));
});

test('mock statement feed: optional jitter feeds the tolerance rules', () => {
  const feed = generateMockStatementFeed({
    transactions: RECORDED_FIXTURE,
    start: DATE,
    end: '2026-09-27',
    shiftDays: 1,
    jitterCents: 10,
  });
  // Line 2 (i=2) is jittered +10 cents, line 1 (i=1) is shifted +1 day.
  assert.equal(feed[1].amount, 224.1);
  assert.equal(feed[1].date, DATE);
  assert.equal(feed[0].date, '2026-09-27');

  const strict = reconcileBankFeed({ transactions: RECORDED_FIXTURE, statementLines: feed });
  // Only the unshifted, unjittered third line still matches exactly.
  assert.equal(strict.matched, 1);
  const tolerant = reconcileBankFeed({
    transactions: RECORDED_FIXTURE,
    statementLines: feed,
    toleranceCents: 20,
    dateWindowDays: 2,
  });
  assert.equal(tolerant.matched, 3);
  assert.equal(tolerant.unmatched, 0);
});

// ─── Dry-run end-to-end: no network, no credentials ─────────────────────────
function makeFakePool(rows = {}) {
  const executed = [];
  return {
    executed,
    async execute(sql) {
      executed.push(sql);
      if (sql.includes('FROM cash_drawer_transactions')) return [rows.drawer || []];
      if (sql.includes('FROM orders')) return [rows.orders || []];
      if (sql.includes('accounting_sync_logs')) return [rows.log || []];
      if (sql.includes('FROM company_settings')) return [rows.settings || []];
      return [[]];
    },
  };
}

test('dry-run reconcile: mock feed end-to-end and zero network calls', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('NETWORK CALL IN MOCK MODE');
  };
  try {
    const pool = makeFakePool({
      drawer: [
        {
          id: 10,
          transaction_type: 'sale',
          amount: '112.00',
          reason: 'Order #ABCD1234',
          staff_name: 'Jane Dela Cruz',
          created_at: '2026-09-26 10:15:00',
        },
      ],
      // Completed cash order — the drawer row's 'Order #ABCD1234' reason joins
      // back to it by id prefix.
      orders: [
        {
          id: 'abcd1234-1111-2222-3333-444444444444',
          total: '112.00',
          pay_method: 'cash',
          reference_number: null,
          created_at: '2026-09-26 10:15:00',
        },
      ],
    });

    const res = await reconcileBankStatements(pool, { start: DATE, end: DATE });
    assert.equal(res.provider, 'xero');
    assert.equal(res.live, false);
    assert.equal(res.mode, 'mock');
    assert.equal(res.dryRun, true);
    assert.equal(res.matched, 1);
    assert.equal(res.unmatched, 0);
    assert.equal(res.variance, 0);
    assert.equal(res.summary.source, 'mock_feed');
    assert.equal(res.results[0].drawerTransactionId, 10);
    assert.equal(res.results[0].orderId, 'abcd1234-1111-2222-3333-444444444444');
    assert.ok(Array.isArray(res.payload), 'dry-run returns the statement payload');
    // The reconcile ledger row is written with provider = xero.
    const insert = pool.executed.find((s) => s.includes('INSERT INTO accounting_sync_logs'));
    assert.ok(insert, 'reconcile attempt logged');

    // The API client refuses before any fetch while mock.
    await assert.rejects(() => xeroRequest(pool, 'Organisation'), /mock mode/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('forceDryRun / isLive: env flag pins everything to mock', () => {
  const prev = process.env.XERO_DRY_RUN;
  process.env.XERO_DRY_RUN = '1';
  try {
    assert.equal(forceDryRun(), true);
    assert.equal(isLive({ connected: true, clientIdConfigured: true }), false);
  } finally {
    if (prev === undefined) delete process.env.XERO_DRY_RUN;
    else process.env.XERO_DRY_RUN = prev;
  }
  if (prev === undefined) {
    assert.equal(forceDryRun(), false);
    assert.equal(isLive({ connected: true, clientIdConfigured: true }), true);
  }
  assert.equal(isLive({ connected: false, clientIdConfigured: true }), false);
  assert.equal(isLive({ connected: true, clientIdConfigured: false }), false);
  assert.equal(isLive(null), false);
});

// ─── Status contract (GET /api/accounting/:provider/status) ─────────────────
test('status: xero exposes the shared contract fields', async () => {
  const state = await getXeroConnectionState(makeFakePool());
  assert.equal(state.provider, 'xero');
  assert.equal(state.connected, false);
  assert.equal(state.mode, 'mock');
  assert.equal(state.clientIdConfigured, false);
  assert.equal(state.tenantId, null);
  assert.equal(state.tokenExpiresAt, null);
  assert.deepEqual(state.features, ['invoice', 'reconcile']);
});

test('status: quickbooks keeps its fields and gains the shared contract fields', async () => {
  const state = await getQuickBooksConnectionState(makeFakePool());
  assert.equal(state.provider, 'quickbooks');
  assert.equal(state.connected, false);
  assert.equal(state.mode, 'mock');
  assert.equal(state.realmId, null);
  assert.equal(state.tenantId, null);
  assert.equal(state.tokenExpiresAt, null);
  assert.deepEqual(state.features, ['invoice', 'bill']);
});
