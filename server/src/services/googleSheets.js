import { google } from 'googleapis';

export function googleSheetsClientInit(){
  const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  let keyObj = null;
  try {
    keyObj = typeof keyEnv === 'string' ? JSON.parse(keyEnv) : keyEnv;
  } catch(e){ keyObj = null; }
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
    async appendOrder({ orderId, staffName, items, subtotal, tax, total, payMethod, status }){
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      const values = [
        new Date().toISOString(),
        orderId,
        staffName,
        items.map(i => i.name).join(', '),
        subtotal,
        tax,
        total,
        payMethod,
        status
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Orders!A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] }
      });
    }
  };
}
