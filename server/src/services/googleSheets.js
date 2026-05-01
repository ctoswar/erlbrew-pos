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
    async appendOrder({ orderId, staffName, items, subtotal, tax, total, payMethod, status }) {
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
        status,
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] },
      });
    },
  };
}