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

// ── TimeClock tab resolver (separate cache) ─────────────────────────────────
let cachedClockTabName = null;

async function resolveClockTabName(sheets, spreadsheetId) {
  if (cachedClockTabName) return cachedClockTabName;
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = res.data.sheets || [];
  const clockTab = sheetsList.find((s) => s.properties.title === 'Sheet2');
  cachedClockTabName = clockTab ? 'Sheet2' : (sheetsList[0]?.properties.title || 'Sheet1');
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

// ── Sheet3 tab resolver ─────────────────────────────────────────────────────
let cachedSheet3TabName = null;

async function resolveSheet3TabName(sheets, spreadsheetId) {
  if (cachedSheet3TabName) return cachedSheet3TabName;
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = res.data.sheets || [];
  const tab = sheetsList.find((s) => s.properties.title === 'Sheet3');
  cachedSheet3TabName = tab ? 'Sheet3' : (sheetsList[0]?.properties.title || 'Sheet1');
  return cachedSheet3TabName;
}

async function ensureSheet3Exists(sheets, spreadsheetId) {
  const tabName = await resolveSheet3TabName(sheets, spreadsheetId);
  // Check if Sheet3 already exists
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetsList = res.data.sheets || [];
  const exists = sheetsList.some((s) => s.properties.title === 'Sheet3');
  if (!exists) {
    // Create Sheet3 by duplicating Sheet1 (Sheets API doesn't have a direct "create sheet" call,
    // but we can use batchUpdate with an addSheet request)
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{ addSheet: { properties: { title: 'Sheet3', index: 2 } } }],
        },
      });
      cachedSheet3TabName = 'Sheet3';
      return 'Sheet3';
    } catch (e) {
      // Fall back to first sheet
      console.error('Could not create Sheet3, falling back:', e.message);
      cachedSheet3TabName = sheetsList[0]?.properties.title || 'Sheet1';
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
      console.log('[DEBUG appendOrder] Called with - payMethod:', payMethod, 'referenceNumber:', JSON.stringify(referenceNumber), 'type:', typeof referenceNumber);
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

      const tabName = await ensureSheet3Exists(sheets, spreadsheetId);

      // ── Compute summary (same logic as frontend buildDailySummary) ──────────
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

      // ── Build all rows for Sheet3 ─────────────────────────────────────────
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

      // Write all rows to Sheet3 starting at A1
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
        console.error('Sheet3 formatting/chart error (non-fatal):', e.message);
      }
      return { jwtClient, sheets };
    },
  };
}