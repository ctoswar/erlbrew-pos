import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

export default function supplierInvoiceRouter(pool) {
  const router = Router();

  // GET all supplier invoices
  router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [invoices] = await pool.execute(`
        SELECT si.*,
          (SELECT SUM(total_price) FROM supplier_invoice_items WHERE invoice_id = si.id) as subtotal_sum
        FROM supplier_invoices si
        ORDER BY si.invoice_date DESC
      `);
      res.json(invoices);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // GET single supplier invoice with items
  router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const [invoices] = await pool.execute(
        `SELECT * FROM supplier_invoices WHERE id = ?`,
        [req.params.id]
      );
      if (!invoices.length) return res.status(404).json({ error: 'Invoice not found' });

      const [items] = await pool.execute(
        `SELECT * FROM supplier_invoice_items WHERE invoice_id = ?`,
        [req.params.id]
      );

      res.json({ ...invoices[0], items });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // POST create supplier invoice
  router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
    const {
      invoice_number, supplier_name, contact_person, contact_phone, contact_email,
      invoice_date, due_date, subtotal, tax_amount, total_amount,
      status, notes, items = []
    } = req.body;

    if (!invoice_number || !supplier_name || !invoice_date || total_amount == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const [result] = await pool.execute(`
        INSERT INTO supplier_invoices
          (invoice_number, supplier_name, contact_person, contact_phone, contact_email,
           invoice_date, due_date, subtotal, tax_amount, total_amount, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice_number, supplier_name, contact_person || null, contact_phone || null,
        contact_email || null, invoice_date, due_date || null,
        subtotal || 0, tax_amount || 0, total_amount, status || 'pending', notes || null
      ]);

      const invoiceId = result.insertId;

      // Insert line items
      for (const item of items) {
        await pool.execute(`
          INSERT INTO supplier_invoice_items (invoice_id, item_description, quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?)
        `, [invoiceId, item.item_description, item.quantity || 1, item.unit_price, item.total_price]);
      }

      res.json({ ok: true, id: invoiceId });
      await logAudit(pool, req, { action: 'supplier_invoice_create', entityType: 'supplier_invoice', entityId: String(invoiceId), details: { invoice_number, supplier_name, total_amount } });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Invoice number already exists' });
      }
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // PUT update supplier invoice
  router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const {
      invoice_number, supplier_name, contact_person, contact_phone, contact_email,
      invoice_date, due_date, subtotal, tax_amount, total_amount,
      status, notes, items = []
    } = req.body;

    try {
      const [existing] = await pool.execute(`SELECT id FROM supplier_invoices WHERE id = ?`, [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: 'Invoice not found' });

      await pool.execute(`
        UPDATE supplier_invoices SET
          invoice_number = ?, supplier_name = ?, contact_person = ?, contact_phone = ?,
          contact_email = ?, invoice_date = ?, due_date = ?, subtotal = ?, tax_amount = ?,
          total_amount = ?, status = ?, notes = ?
        WHERE id = ?
      `, [
        invoice_number, supplier_name, contact_person || null, contact_phone || null,
        contact_email || null, invoice_date, due_date || null,
        subtotal || 0, tax_amount || 0, total_amount, status || 'pending', notes || null,
        req.params.id
      ]);

      // Delete old items and insert new ones
      await pool.execute(`DELETE FROM supplier_invoice_items WHERE invoice_id = ?`, [req.params.id]);
      for (const item of items) {
        await pool.execute(`
          INSERT INTO supplier_invoice_items (invoice_id, item_description, quantity, unit_price, total_price)
          VALUES (?, ?, ?, ?, ?)
        `, [req.params.id, item.item_description, item.quantity || 1, item.unit_price, item.total_price]);
      }

      res.json({ ok: true });
      await logAudit(pool, req, { action: 'supplier_invoice_update', entityType: 'supplier_invoice', entityId: req.params.id, details: { invoice_number, supplier_name, total_amount } });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Invoice number already exists' });
      }
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // DELETE supplier invoice
  router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      await pool.execute('DELETE FROM supplier_invoices WHERE id = ?', [req.params.id]);
      await logAudit(pool, req, { action: 'supplier_invoice_delete', entityType: 'supplier_invoice', entityId: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'DB error' });
    }
  });

  return router;
}