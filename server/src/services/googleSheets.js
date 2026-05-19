import { google } from 'googleapis';

// Cached tab name (resolved on first append)
let cachedTabName = null;

async function resolveTabName(sheets, spreadsheetId) {
  if (cachedTabName) return cachedTabName;
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = res.data.sheets || [];
  const ordersTab = sheetsList.find((s) => s.properties.title === 'Orders');
  cachedTabName = ordersTab ? 'Orders' : (sheetsList[0]?.properties.title || 'Sheet1');
  return cachedTabName;
}

let cachedClockTabName = null;

async function resolveClockTabName(sheets, spreadsheetId) {
  if (cachedClockTabName) return cachedClockTabName;
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = res.data.sheets || [];
  const clockTab = sheetsList.find((s) => s.properties.title === 'Time Records');
  cachedClockTabName = clockTab ? 'Time Records' : (sheetsList[0]?.properties.title || 'Sheet1');
  return cachedClockTabName;
}

// In-memory cache of menu item names: { id -> name }
let menuItemCache = {};
let cacheLoaded = false;

async function loadMenuItemNames(pool) {
  if (cacheLoaded) return;
  try {
    const [rows] = await pool.query('SELECT id, name FROM menu_items');
    menuItemCache = {};
    for (const row of rows) {
      menuItemCache[row.id] = row.name;
    }
    cacheLoaded = true;
  } catch (e) {
    console.error('Failed to load menu item names for Sheets:', e.message);
  }
}

let cachedDashboardTabName = null;

async function resolveDashboardTabName(sheets, spreadsheetId) {
  if (cachedDashboardTabName) return cachedDashboardTabName;
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = res.data.sheets || [];
  const tab = sheetsList.find((s) => s.properties.title === 'Dashboard');
  cachedDashboardTabName = tab ? 'Dashboard' : (sheetsList[0]?.properties.title || 'Sheet1');
  return cachedDashboardTabName;
}

async function ensureDashboardExists(sheets, spreadsheetId) {
  const tabName = await resolveDashboardTabName(sheets, spreadsheetId);
  // Check if Dashboard already exists
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = res.data.sheets || [];
  const exists = sheetsList.some((s) => s.properties.title === 'Dashboard');
  if (!exists) {
    // Create Dashboard tab
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{ addSheet: { properties: { title: 'Dashboard', index: 2 } } }],
        },
      });
      cachedDashboardTabName = 'Dashboard';
      return 'Dashboard';
    } catch (e) {
      // Fall back to first sheet
      console.error('Could not create Dashboard, falling back:', e.message);
      cachedDashboardTabName = sheetsList[0]?.properties.title || 'Sheet1';
    }
  }
  return tabName;
}

function fmt(n) { return Number(n || 0); }

export function googleSheetsClientInit(pool) {
  const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let keyObj = null;
  try {
    keyObj = typeof keyEnv === 'string' ? JSON.parse(keyEnv) : keyEnv;
  } catch (e) { keyObj = null; }
  if (!keyObj || !process.env.GOOGLE_SHEETS_ID) return null;

  const jwtClient = new google.auth.JWT({
    email: keyObj.client_email,
    key: keyObj.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth: jwtClient });

  return {
    jwtClient,
    sheets,
    async appendTimeRecord({ staffName, role, action, clockIn, clockOut, totalHours }) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      const tabName = await resolveClockTabName(sheets, spreadsheetId);

      const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const clockInStr = clockIn ? new Date(clockIn).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—';
      const clockOutStr = clockOut ? new Date(clockOut).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—';
      const hoursStr = totalHours != null ? `${Number(totalHours).toFixed(2)} hrs` : '—';

      const values = [ts, staffName, role, action, clockInStr, clockOutStr, hoursStr];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] },
      });
    },
    async appendOrder({ orderId, staffName, items, subtotal, tax, total, payMethod, status, referenceNumber }) {
      // Refresh menu item names from DB before each append
      await loadMenuItemNames(pool);

      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      const tabName = await resolveTabName(sheets, spreadsheetId);

// Build readable item list — guard against undefined/null items
    const itemList = items && Array.isArray(items) && items.length > 0
      ? items.map((it) => {
          const name = menuItemCache[it.id] || it.id || '(unknown)';
          return `${it.qty}× ${name}`;
        }).join(' | ')
      : '(no items)';

      const values = [
        new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
        orderId,
        staffName,
        itemList,
        `₱${Number(subtotal).toFixed(2)}`,
        `₱${Number(tax).toFixed(2)}`,
        `₱${Number(total).toFixed(2)}`,
        payMethod,
        referenceNumber || '—',
        status,
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] },
      });
    },
    async appendDashboard({ orders, cogsData }) {
      await loadMenuItemNames(pool);
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) return;

      const tabName = await ensureDashboardExists(sheets, spreadsheetId);

      // Compute summary (same logic as frontend buildDailySummary)
      const completed = (orders || []).filter((o) => o.status === 'completed');
      const totalRevenue = completed.reduce((s, o) => s + fmt(o.total), 0);
      const totalOrders = completed.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const totalCOGS = fmt(cogsData?.cogs);
      const grossProfit = totalRevenue - totalCOGS;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      // Top items
      const itemMap = {};
      completed.forEach((o) =>
        (o.items || []).forEach((ci) => {
          const name = ci.item?.name || ci.id || '(unknown)';
          itemMap[name] = (itemMap[name] || 0) + (ci.qty || 0);
        })
      );
      const topItems = Object.entries(itemMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      // By category
      const catMap = {};
      completed.forEach((o) =>
        (o.items || []).forEach((ci) => {
          const cat = ci.item?.category || 'Other';
          if (!catMap[cat]) catMap[cat] = { revenue: 0, count: 0 };
          catMap[cat].revenue += fmt(ci.item?.price) * (ci.qty || 0);
          catMap[cat].count += ci.qty || 0;
        })
      );
      const byCategory = Object.entries(catMap).map(([category, data]) => ({ category, ...data }));

      // By payment method
      const payMap = {};
      completed.forEach((o) => {
        const m = o.payMethod || 'unknown';
        if (!payMap[m]) payMap[m] = { count: 0, total: 0 };
        payMap[m].count++;
        payMap[m].total += fmt(o.total);
      });
      const byPayMethod = Object.entries(payMap).map(([method, data]) => ({ method, ...data }));

      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

      const rows = [];

      // Title
      rows.push(['ERLBREW CAFE — Daily Dashboard', '', '', '', '', '', '']);
      rows.push(['Generated:', now, '', '', '', '', '']);
      rows.push(['', '', '', '', '', '', '']);

      // KPI Summary
      rows.push(['── KPI SUMMARY ──', '', '', '', '', '', '']);
      rows.push(['Total Revenue', `₱${totalRevenue.toFixed(2)}`]);
      rows.push(['Total Orders', String(totalOrders)]);
      rows.push(['Avg Order Value', `₱${avgOrderValue.toFixed(2)}`]);
      rows.push(['COGS', `₱${totalCOGS.toFixed(2)}`]);
      rows.push(['Gross Profit', `₱${grossProfit.toFixed(2)}`]);
      rows.push(['Profit Margin', `${profitMargin.toFixed(1)}%`]);
      rows.push(['', '']);

      // Top Items (for bar chart: Item | Qty)
      rows.push(['── TOP ITEMS ──', '', '']);
      rows.push(['Item', 'Qty Sold']);
      topItems.forEach((it) => rows.push([it.name, it.qty]));
      rows.push(['']);

      // By Category (for bar/pie chart: Category | Revenue | Count)
      rows.push(['── REVENUE BY CATEGORY ──', '', '']);
      rows.push(['Category', 'Revenue (₱)', 'Items Sold']);
      byCategory.forEach((c) => rows.push([c.category, c.revenue, c.count]));
      rows.push(['']);

      // By Payment Method (for pie chart: Method | Total | Count)
      rows.push(['── PAYMENT METHODS ──', '', '']);
      rows.push(['Method', 'Total (₱)', 'Orders']);
      byPayMethod.forEach((p) => rows.push([p.method, p.total, p.count]));
      rows.push(['']);

      // Daily Orders (for line chart: Hour | Orders | Revenue)
      rows.push(['── HOURLY BREAKDOWN ──', '', '']);
      rows.push(['Hour', 'Orders', 'Revenue (₱)']);
      // Aggregate by hour
      const hourMap = {};
      completed.forEach((o) => {
        const d = new Date(o.createdAt);
        const h = d.getHours();
        if (!hourMap[h]) hourMap[h] = { count: 0, revenue: 0 };
        hourMap[h].count++;
        hourMap[h].revenue += fmt(o.total);
      });
      Object.entries(hourMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([h, data]) => {
          const label = `${String(h).padStart(2, '0')}:00`;
          rows.push([label, data.count, data.revenue]);
        });
      rows.push(['']);

// Order Detail
      rows.push(['── ORDER DETAIL ──', '', '', '', '', '', '', '', '', '', '']);
      rows.push(['Timestamp', 'Order ID', 'Staff', 'Type', 'Items', 'Subtotal', 'Tax', 'Total', 'Pay Method', 'Ref No', 'Status']);
      completed.forEach((o) => {
        const ts = new Date(o.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        const itemList = (o.items || []).map((it) => {
          const name = menuItemCache[it.id] || it.item?.name || it.id || '(?)';
          return `${it.qty}× ${name}`;
        }).join(' | ') || '(no items)';
        rows.push([
          ts,
          o.id || '—',
          o.staff?.name || '—',
          o.type === 'dine-in' ? `Table ${o.table}` : 'Takeout',
          itemList,
          fmt(o.subtotal).toFixed(2),
          fmt(o.tax).toFixed(2),
          fmt(o.total).toFixed(2),
          o.payMethod || '—',
          o.referenceNumber || '—',
          o.status || '—',
        ]);
      });

      // Write all rows to Dashboard starting at A1
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows },
      });

      // Apply formatting + embedded charts
      try {
        // Calculate row ranges for charts
        const kpiStartRow = 3;   // "── KPI SUMMARY ──"
        const kpiEndRow   = 10;  // blank after profit margin
        const topStart    = 12;  // "── TOP ITEMS ──"
        const topEnd      = 11 + Math.min(topItems.length, 5) + 1;  // header + data
        const catStart    = 19;  // "── REVENUE BY CATEGORY ──"
        const catEnd      = 19 + Math.min(byCategory.length, 5) + 1;
        const payStart    = 26;   // "── PAYMENT METHODS ──"
        const payEnd      = 26 + Math.min(byPayMethod.length, 3) + 1;
        const hourStart   = 33;  // "── HOURLY BREAKDOWN ──"
        const hourEnd     = rows.length - 1; // last row before order detail

        const charts = [
          // Bar chart: Top Items (only if there's data)
          topItems.length > 0 ? {
            spec: {
              title: 'Top Selling Items',
              basicChart: {
                chartType: 'BAR',
                legendPosition: 'BOTTOM_LEGEND',
                axis: [
                  { position: 'LEFT_AXIS', title: 'Qty Sold' },
                  { position: 'BOTTOM_AXIS', title: 'Item' },
                ],
                // Domain: single column (item names in col A, skip header)
                domains: [{ domain: { sourceRange: { sources: [{ sheetId: 0, startRowIndex: topStart + 1, endRowIndex: topEnd, startColumnIndex: 0, endColumnIndex: 1 }] } } }],
                // Series: single column (quantities in col B, skip header)
                series: [{ series: { sourceRange: { sources: [{ sheetId: 0, startRowIndex: topStart + 1, endRowIndex: topEnd, startColumnIndex: 1, endColumnIndex: 2 }] } }, targetAxis: 'LEFT_AXIS' }],
                headerCount: 1,
              },
            },
            position: { overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 0, columnIndex: 11 } } },
          } : null,
          // Pie chart: Revenue by Category (only if there's data)
          byCategory.length > 0 ? {
            spec: {
              title: 'Revenue by Category',
              pieChart: {
                legendPosition: 'RIGHT_LEGEND',
                series: {
                  sourceRange: {
                    sources: [{ sheetId: 0, startRowIndex: catStart + 1, endRowIndex: catEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                  },
                },
                domain: {
                  sourceRange: {
                    sources: [{ sheetId: 0, startRowIndex: catStart + 1, endRowIndex: catEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                  },
                },
              },
            },
            position: { overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 12, columnIndex: 11 } } },
          } : null,
          // Pie chart: Payment Methods (only if there's data)
          byPayMethod.length > 0 ? {
            spec: {
              title: 'Payment Methods',
              pieChart: {
                legendPosition: 'RIGHT_LEGEND',
                series: {
                  sourceRange: {
                    sources: [{ sheetId: 0, startRowIndex: payStart + 1, endRowIndex: payEnd, startColumnIndex: 1, endColumnIndex: 2 }],
                  },
                },
                domain: {
                  sourceRange: {
                    sources: [{ sheetId: 0, startRowIndex: payStart + 1, endRowIndex: payEnd, startColumnIndex: 0, endColumnIndex: 1 }],
                  },
                },
              },
            },
            position: { overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 24, columnIndex: 11 } } },
          } : null,
          // Line chart: Hourly orders + revenue (only if there's data)
          hourEnd > hourStart + 1 ? {
            spec: {
              title: 'Hourly Orders & Revenue',
              basicChart: {
                chartType: 'LINE',
                legendPosition: 'BOTTOM_LEGEND',
                axis: [
                  { position: 'LEFT_AXIS', title: 'Count / Revenue' },
                  { position: 'BOTTOM_AXIS', title: 'Hour' },
                ],
                series: [
                  { series: { sourceRange: { sources: [{ sheetId: 0, startRowIndex: hourStart + 1, endRowIndex: hourEnd, startColumnIndex: 1, endColumnIndex: 2 }] } }, targetAxis: 'LEFT_AXIS', color: { red: 0.79, green: 0.53, blue: 0.23 } },
                  { series: { sourceRange: { sources: [{ sheetId: 0, startRowIndex: hourStart + 1, endRowIndex: hourEnd, startColumnIndex: 2, endColumnIndex: 3 }] } }, targetAxis: 'LEFT_AXIS', color: { red: 0.30, green: 0.69, blue: 0.31 } },
                ],
                domains: [{ domain: { sourceRange: { sources: [{ sheetId: 0, startRowIndex: hourStart + 1, endRowIndex: hourEnd, startColumnIndex: 0, endColumnIndex: 1 }] } } }],
                headerCount: 1,
              },
            },
            position: { overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 0, columnIndex: 22 } } },
          } : null,
        ].filter(Boolean);

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              // Add all 4 charts
              ...charts.map((ch) => ({
                addChart: {
                  chart: {
                    spec: ch.spec,
                    position: ch.position,
                  },
                },
              })),
              // Bold title
              {
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
                  cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 0.79, green: 0.53, blue: 0.23 } } } },
                  fields: 'userEnteredFormat(textFormat)',
                },
              },
              // Bold KPI section header row (row 3)
              {
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 1 },
                  cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 0.79, green: 0.53, blue: 0.23 } } } },
                  fields: 'userEnteredFormat(textFormat)',
                },
              },
              // Bold section headers throughout
              ...[12, 19, 26, 33, 37].map((r) => ({
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 1 },
                  cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 0.79, green: 0.53, blue: 0.23 } } } },
                  fields: 'userEnteredFormat(textFormat)',
                },
              })),
              // Bold order detail headers (row 37+1 = 38)
              {
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: 38, endRowIndex: 39, startColumnIndex: 0, endColumnIndex: 10 },
                  cell: { userEnteredFormat: { textFormat: { bold: true } } },
                  fields: 'userEnteredFormat(textFormat)',
                },
              },
              // Number format for currency rows
              {
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: 4, endRowIndex: 10, startColumnIndex: 1, endColumnIndex: 2 },
                  cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '₱#,##0.00' } } },
                  fields: 'userEnteredFormat(numberFormat)',
                },
              },
              // Number format for revenue rows in category/pay sections
              {
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: catStart + 1, endRowIndex: catEnd, startColumnIndex: 1, endColumnIndex: 2 },
                  cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '₱#,##0' } } },
                  fields: 'userEnteredFormat(numberFormat)',
                },
              },
              {
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: payStart + 1, endRowIndex: payEnd, startColumnIndex: 1, endColumnIndex: 2 },
                  cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '₱#,##0' } } },
                  fields: 'userEnteredFormat(numberFormat)',
                },
},
            // Freeze top row
            {
              updateSheetProperties: {
                properties: { title: tabName, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        },
      });
    } catch (e) {
      console.error('Dashboard formatting/chart error (non-fatal):', e.message);
    }
    return { jwtClient, sheets };
    },

    // ── Payroll — append payroll entries when computed ──────────────
    async appendPayrollEntries({ period, entries }) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) return;

      // Ensure Payroll tab exists
      const res0 = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetsList = res0.data.sheets || [];
      let tabName = 'Payroll';
      const payrollTab = sheetsList.find(s => s.properties.title === 'Payroll');
      if (!payrollTab) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: 'Payroll', index: 3 } } }] },
          });
        } catch (e) { console.error('Could not create Payroll tab (non-fatal):', e.message); }
      }

      const rows = [];
      const periodLabel = period.label || `${period.date_from} to ${period.date_to}`;

      rows.push([
        '── PAYROLL ──', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
      ]);
      rows.push([
        'Period:', periodLabel, '', 'Status:', period.status, '', 'Computed:', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }), '', '', '', '', '', '', '', '', ''
      ]);
      rows.push(['']);
      rows.push([
        'Staff', 'Role', 'Pay Basis', 'Total Hrs', 'Regular Hrs', 'OT Hrs',
        'Basic Pay', 'OT Pay', 'Gross Pay',
        'SSS (EE)', 'PhilHealth (EE)', 'Pag-IBIG (EE)', 'WHT', 'Total Deductions', 'Net Pay',
        'SSS (ER)', 'PhilHealth (ER)', 'Pag-IBIG (ER)'
      ]);

      for (const e of entries) {
        rows.push([
          e.name || `Staff #${e.staff_id}`,
          e.role || '',
          e.pay_basis || 'daily',
          Number(e.total_hours || 0).toFixed(2),
          Number(e.regular_hours || 0).toFixed(2),
          Number(e.overtime_hours || 0).toFixed(2),
          fmt(e.basic_pay),
          fmt(e.overtime_pay),
          fmt(e.gross_pay),
          fmt(e.sss_employee),
          fmt(e.philhealth_employee),
          fmt(e.pagibig_employee),
          fmt(e.withholding_tax),
          fmt(e.total_deductions),
          fmt(e.net_pay),
          fmt(e.sss_employer),
          fmt(e.philhealth_employer),
          fmt(e.pagibig_employer),
        ]);
      }

      // Totals row
      const totalsRow = [
        'TOTALS', '', '', 
        Number(entries.reduce((s, e) => s + Number(e.total_hours || 0), 0)).toFixed(2),
        Number(entries.reduce((s, e) => s + Number(e.regular_hours || 0), 0)).toFixed(2),
        Number(entries.reduce((s, e) => s + Number(e.overtime_hours || 0), 0)).toFixed(2),
        fmt(entries.reduce((s, e) => s + Number(e.basic_pay || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.overtime_pay || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.gross_pay || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.sss_employee || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.philhealth_employee || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.pagibig_employee || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.withholding_tax || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.total_deductions || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.net_pay || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.sss_employer || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.philhealth_employer || 0), 0)),
        fmt(entries.reduce((s, e) => s + Number(e.pagibig_employer || 0), 0)),
      ];
      rows.push(totalsRow);

      // Clear and rewrite Payroll tab
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A:R` });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rows },
      });
    },

    // ── Append a single row to Payroll tab when payroll is approved/paid ────────
    async appendPayrollStatusChange({ period, status, staffName }) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) return;

      try {
        const res0 = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetsList = res0.data.sheets || [];
        const payrollTab = sheetsList.find(s => s.properties.title === 'Payroll');
        if (!payrollTab) return; // Payroll tab not created yet, skip

        const tabName = 'Payroll';
        const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        const values = [ts, 'PAYROLL_STATUS', `Period ${period.label || period.date_from}: ${status}`, `By: ${staffName || 'System'}`];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${tabName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [values] },
        });
      } catch (e) { console.error('[Sheets] Payroll status append failed (non-fatal):', e.message); }
    },

    // ── Voids/Refunds + Z-Reports ─────────────────────────────────────────────
    async appendVoidRefund({ type, orderId, reason, staffName, total, items }) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) return;

      try {
        const res0 = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetsList = res0.data.sheets || [];
        let tabName = 'Voids/Refunds + Z-Reports';
        const vrTab = sheetsList.find(s => s.properties.title === 'Voids/Refunds + Z-Reports');
        if (!vrTab) {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: { requests: [{ addSheet: { properties: { title: 'Voids/Refunds + Z-Reports', index: 4 } } }] },
            });
          } catch (e2) { console.error('Could not create Voids/Refunds + Z-Reports tab (non-fatal):', e2.message); }
        }

        const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        const values = [ts, type.toUpperCase(), orderId, staffName || '—', `₱${Number(total || 0).toFixed(2)}`, items || '—', reason || '—'];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${tabName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [values] },
        });
      } catch (e) { console.error('[Sheets] Void/refund append failed (non-fatal):', e.message); }
    },

    // ── Cash Drawer + Inventory ──────────────────────────────────────────────────
    async appendCashDrawerEvent({ type, shiftDate, amount, staffName, reason, details }) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) return;

      try {
        const res0 = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetsList = res0.data.sheets || [];
        let tabName = 'Cash Drawer + Inventory';
        const cdiTab = sheetsList.find(s => s.properties.title === 'Cash Drawer + Inventory');
        if (!cdiTab) {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: { requests: [{ addSheet: { properties: { title: 'Cash Drawer + Inventory', index: 5 } } }] },
            });
          } catch (e2) { console.error('Could not create Cash Drawer + Inventory tab (non-fatal):', e2.message); }
        }

        const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        const values = [ts, type, shiftDate || '—', `₱${Number(amount || 0).toFixed(2)}`, staffName || '—', reason || '—', details || '—'];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${tabName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [values] },
        });
      } catch (e) { console.error('[Sheets] Cash drawer append failed (non-fatal):', e.message); }
    },

    // ── Z-Report to Sheet ────────────────────────────────────────────────
    async appendZReport(report) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) return;

      try {
        const res0 = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetsList = res0.data.sheets || [];
        let tabName = 'Voids/Refunds + Z-Reports';
        const vrTab = sheetsList.find(s => s.properties.title === 'Voids/Refunds + Z-Reports');
        if (!vrTab) {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: { requests: [{ addSheet: { properties: { title: 'Voids/Refunds + Z-Reports', index: 4 } } }] },
            });
          } catch (e2) { console.error('Could not create Voids/Refunds + Z-Reports tab for Z-report (non-fatal):', e2.message); }
        }

        const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        const values = [
          ts, 'Z-REPORT',
          report.report_date || '—',
          fmt(report.total_sales), fmt(report.total_orders),
          fmt(report.total_cash), fmt(report.total_card), fmt(report.total_ewallet),
          fmt(report.total_refunds), fmt(report.total_voids),
          fmt(report.total_cogs), fmt(report.gross_profit),
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${tabName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [values] },
        });
      } catch (e) { console.error('[Sheets] Z-report append failed (non-fatal):', e.message); }
    },

    // ── Inventory movement to Sheet ───────────────────────────────────────
    async appendInventoryMovement({ itemId, itemName, movementType, quantity, stockBefore, stockAfter, notes }) {
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      if (!spreadsheetId) return;

      try {
        const res0 = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetsList = res0.data.sheets || [];
        let tabName = 'Cash Drawer + Inventory';
        const cdiTab = sheetsList.find(s => s.properties.title === 'Cash Drawer + Inventory');
        if (!cdiTab) {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              resource: { requests: [{ addSheet: { properties: { title: 'Cash Drawer + Inventory', index: 5 } } }] },
            });
          } catch (e2) { console.error('Could not create Cash Drawer + Inventory tab (non-fatal):', e2.message); }
        }

        const ts = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
        const values = [ts, movementType, itemId, itemName || '—', Number(quantity || 0), Number(stockBefore || 0), Number(stockAfter || 0), notes || '—'];

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${tabName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [values] },
        });
      } catch (e) { console.error('[Sheets] Inventory movement append failed (non-fatal):', e.message); }
    },
  };
}