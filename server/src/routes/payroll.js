import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

// ── PH Payroll Constants (2025–2026 Rates) ──────────────────────────────────
const SSS_RATES = {
  EMPLOYEE: 0.045,  // 4.5% of MSC (5% increase deferred)
  EMPLOYER: 0.095,  // 9.5% of MSC (total 14%)
};

// SSS Monthly Salary Credit brackets (simplified — bracket lookup)
const SSS_MSC_BRACKETS = [
  { min: 0, max: 4250, msc: 4250 },
  { min: 4250, max: 4750, msc: 4500 },
  { min: 4750, max: 5250, msc: 5000 },
  { min: 5250, max: 5750, msc: 5500 },
  { min: 5750, max: 6250, msc: 6000 },
  { min: 6250, max: 6750, msc: 6500 },
  { min: 6750, max: 7250, msc: 7000 },
  { min: 7250, max: 7750, msc: 7500 },
  { min: 7750, max: 8250, msc: 8000 },
  { min: 8250, max: 8750, msc: 8500 },
  { min: 8750, max: 9250, msc: 9000 },
  { min: 9250, max: 9750, msc: 9500 },
  { min: 9750, max: 10250, msc: 10000 },
  { min: 10250, max: 10750, msc: 10500 },
  { min: 10750, max: 11250, msc: 11000 },
  { min: 11250, max: 11750, msc: 11500 },
  { min: 11750, max: 12250, msc: 12000 },
  { min: 12250, max: 12750, msc: 12500 },
  { min: 12750, max: 13250, msc: 13000 },
  { min: 13250, max: 13750, msc: 13500 },
  { min: 13750, max: 14250, msc: 14000 },
  { min: 14250, max: 14750, msc: 14500 },
  { min: 14750, max: 15250, msc: 15000 },
  { min: 15250, max: 15750, msc: 15500 },
  { min: 15750, max: 16250, msc: 16000 },
  { min: 16250, max: 16750, msc: 16500 },
  { min: 16750, max: 17250, msc: 17000 },
  { min: 17250, max: 17750, msc: 17500 },
  { min: 17750, max: 18250, msc: 18000 },
  { min: 18250, max: 18750, msc: 18500 },
  { min: 18750, max: 19250, msc: 19000 },
  { min: 19250, max: 19750, msc: 19500 },
  { min: 19750, max: 20250, msc: 20000 },
  { min: 20250, max: 20750, msc: 20500 },
  { min: 20750, max: 21250, msc: 21000 },
  { min: 21250, max: 21750, msc: 21500 },
  { min: 21750, max: 22250, msc: 22000 },
  { min: 22250, max: 22750, msc: 22500 },
  { min: 22750, max: 23250, msc: 23000 },
  { min: 23250, max: 23750, msc: 23500 },
  { min: 23750, max: 24250, msc: 24000 },
  { min: 24250, max: 24750, msc: 24500 },
  { min: 24750, max: 25250, msc: 25000 },
  { min: 25250, max: 25750, msc: 25500 },
  { min: 25750, max: 26250, msc: 26000 },
  { min: 26250, max: 26750, msc: 26500 },
  { min: 26750, max: 27250, msc: 27000 },
  { min: 27250, max: 27750, msc: 27500 },
  { min: 27750, max: 28250, msc: 28000 },
  { min: 28250, max: 28750, msc: 28500 },
  { min: 28750, max: 29750, msc: 29000 },
  { min: 29750, Infinity, msc: 35000 },
];

function getSSSMSC(monthlySalary) {
  const s = Number(monthlySalary) || 0;
  for (const b of SSS_MSC_BRACKETS) {
    if (s >= b.min && s < b.max) return b.msc;
  }
  return 35000; // max MSC
}

// PH OT multipliers
const OT_RATES = {
  regular_ot: 1.25,           // 125% on ordinary day
  rest_day: 1.30,             // 130% on rest day
  rest_day_ot: 1.69,         // 130% × 130% on rest day OT
  special_holiday: 1.30,      // 130% on special non-working day
  special_holiday_ot: 1.69,   // 130% × 130% on special non-working OT
  regular_holiday: 2.00,      // 200% on regular holiday
  regular_holiday_ot: 2.60,   // 200% × 130% on regular holiday OT
  night_differential: 0.10,   // +10% for 10pm-6am hours
};

// Simplified BIR withholding tax (semi-monthly, PH 2026)
// Brackets are semi-monthly (monthly thresholds ÷ 2)
function computeWithholdingTax(semiMonthlyTaxableIncome) {
  const i = Number(semiMonthlyTaxableIncome) || 0;
  // Semi-monthly brackets derived from TRAIN law (RA 10963)
  if (i <= 10417) return 0;                                        // ≤ ₱250,000/yr
  if (i <= 16666) return (i - 10417) * 0.15;                       // ₱250k–₱400k
  if (i <= 33333) return 937.45 + (i - 16667) * 0.20;             // ₱400k–₱800k
  if (i <= 83333) return 4270.95 + (i - 33333) * 0.25;            // ₱800k–₱2M
  if (i <= 166667) return 16770.70 + (i - 83333) * 0.30;          // ₱2M–₱4M
  if (i <= 416667) return 41770.70 + (i - 166667) * 0.32;          // ₱4M–₱10M
  return 121770.70 + (i - 416667) * 0.35;                          // > ₱10M
}

// ── Helpers ───────────────────────────────────────────────────────────────
function taipeiNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}
function toMysqlDatetime(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function generatePeriodLabel(dateFrom, dateTo) {
  const from = new Date(dateFrom + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayFrom = from.getDate();
  const dayTo = new Date(dateTo + 'T00:00:00').getDate();
  const month = months[from.getMonth()];
  const year = from.getFullYear();
  const half = dayFrom === 1 ? '1st Half' : '2nd Half';
  return `${month} ${year} - ${half}`;
}

export default function payrollRouter(pool) {
  const router = Router();

  // ── GET /api/payroll/periods — list all payroll periods ────────────────
  router.get('/periods', authMiddleware, async (req, res) => {
    try {
      const [periods] = await pool.query(
        'SELECT * FROM payroll_periods ORDER BY date_from DESC'
      );
      res.json(periods);
    } catch (e) {
      console.error('[Payroll] GET /periods error:', e);
      res.status(500).json({ error: 'Failed to fetch payroll periods' });
    }
  });

  // ── POST /api/payroll/periods — create a new payroll period ────────────
  router.post('/periods', authMiddleware, async (req, res) => {
    const { date_from, date_to, pay_date } = req.body;
    if (!date_from || !date_to) {
      return res.status(400).json({ error: 'date_from and date_to are required' });
    }
    if (date_from >= date_to) {
      return res.status(400).json({ error: 'date_from must be before date_to' });
    }
    const label = generatePeriodLabel(date_from, date_to);
    try {
      const [result] = await pool.query(
        'INSERT INTO payroll_periods (label, date_from, date_to, pay_date, status) VALUES (?, ?, ?, ?, ?)',
        [label, date_from, date_to, pay_date || null, 'open']
      );
      const [rows] = await pool.query('SELECT * FROM payroll_periods WHERE id = ?', [result.insertId]);
      res.json(rows[0]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A payroll period already exists for this date range' });
      }
      console.error('[Payroll] POST /periods error:', e);
      res.status(500).json({ error: 'Failed to create payroll period' });
    }
  });

  // ── PUT /api/payroll/periods/:id — update period (e.g., status, pay_date) ─
  router.put('/periods/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { status, pay_date, label } = req.body;
    try {
      const fields = [];
      const vals = [];
      if (status) { fields.push('status = ?'); vals.push(status); }
      if (pay_date !== undefined) { fields.push('pay_date = ?'); vals.push(pay_date); }
      if (label) { fields.push('label = ?'); vals.push(label); }
      if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
      vals.push(id);
      await pool.query(`UPDATE payroll_periods SET ${fields.join(', ')} WHERE id = ?`, vals);
      const [rows] = await pool.query('SELECT * FROM payroll_periods WHERE id = ?', [id]);
      res.json(rows[0]);
    } catch (e) {
      console.error('[Payroll] PUT /periods/:id error:', e);
      res.status(500).json({ error: 'Failed to update payroll period' });
    }
  });

  // ── DELETE /api/payroll/periods/:id — delete period + entries ──────────
  router.delete('/periods/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      // Delete entries first (FK cascade should handle this, but be explicit)
      await pool.query('DELETE FROM payroll_entries WHERE payroll_period_id = ?', [id]);
      await pool.query('DELETE FROM payroll_periods WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (e) {
      console.error('[Payroll] DELETE /periods/:id error:', e);
      res.status(500).json({ error: 'Failed to delete payroll period' });
    }
  });

  // ── GET /api/payroll/periods/:id/entries — get entries for a period ────
  router.get('/periods/:id/entries', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      const [entries] = await pool.query(`
        SELECT pe.*, s.name, s.role, s.initials, s.color, s.pay_basis, s.daily_rate, s.monthly_salary
        FROM payroll_entries pe
        JOIN staff s ON s.id = pe.staff_id
        WHERE pe.payroll_period_id = ?
        ORDER BY s.name
      `, [id]);
      res.json(entries);
    } catch (e) {
      console.error('[Payroll] GET /periods/:id/entries error:', e);
      res.status(500).json({ error: 'Failed to fetch payroll entries' });
    }
  });

  // ── POST /api/payroll/periods/:id/compute — compute payroll for a period ─
  router.post('/periods/:id/compute', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
      // Get period
      const [periods] = await pool.query('SELECT * FROM payroll_periods WHERE id = ?', [id]);
      if (!periods.length) return res.status(404).json({ error: 'Payroll period not found' });
      const period = periods[0];

      // Get all active staff with payroll fields
      const [staff] = await pool.query(
        'SELECT id, name, role, daily_rate, monthly_salary, pay_basis, tax_status FROM staff WHERE daily_rate IS NOT NULL OR monthly_salary IS NOT NULL'
      );

      // Get time records for the period
      const [timeRecords] = await pool.query(`
        SELECT tr.staff_id,
               SUM(TRUNCATE(TIMESTAMPDIFF(MINUTE, tr.clock_in, COALESCE(tr.clock_out, tr.clock_in)) / 60.0, 2)) AS total_minutes_sum,
               SUM(TIMESTAMPDIFF(MINUTE, tr.clock_in, COALESCE(tr.clock_out, tr.clock_in))) AS total_minutes
        FROM time_records tr
        WHERE DATE(tr.clock_in) >= ? AND DATE(tr.clock_in) <= ?
          AND tr.clock_out IS NOT NULL
        GROUP BY tr.staff_id
      `, [period.date_from, period.date_to]);

      // Build a map of staff_id → total hours
      const hoursMap = {};
      for (const r of timeRecords) {
        hoursMap[r.staff_id] = Number(((r.total_minutes || 0) / 60).toFixed(2));
      }

      // Get days worked in the period per staff
      const [daysWorked] = await pool.query(`
        SELECT tr.staff_id, COUNT(DISTINCT DATE(tr.clock_in)) AS days
        FROM time_records tr
        WHERE DATE(tr.clock_in) >= ? AND DATE(tr.clock_in) <= ?
          AND tr.clock_out IS NOT NULL
        GROUP BY tr.staff_id
      `, [period.date_from, period.date_to]);
      const daysMap = {};
      for (const d of daysWorked) { daysMap[d.staff_id] = d.days; }

      const entries = [];

      for (const s of staff) {
        const totalHours = hoursMap[s.id] || 0;
        const days = daysMap[s.id] || 0;

        // Compute daily/hourly rate
        let hourlyRate;
        let dailyRate = Number(s.daily_rate) || 0;
        let monthlySalary = Number(s.monthly_salary) || 0;

        if (s.pay_basis === 'monthly' && monthlySalary > 0) {
          dailyRate = monthlySalary / 261 * 12; // ~monthly / 261 working days * 12 months = daily
          // Actually: daily rate = monthly salary * 12 / 261 for monthly-paid
          // But simpler: for semi-monthly, half-month pay = monthly_salary / 2
          hourlyRate = dailyRate / 8;
        } else {
          hourlyRate = dailyRate / 8;
        }

        // Regular hours (first 8 per day × days)
        const regularHours = Math.min(totalHours, 8 * days);
        const overtimeHours = Math.max(0, totalHours - regularHours);

        // Earnings
        const basicPay = s.pay_basis === 'monthly'
          ? Number((monthlySalary / 2).toFixed(2))  // semi-monthly = monthly / 2
          : Number((days * dailyRate).toFixed(2));

        const overtimePay = Number((overtimeHours * hourlyRate * 0.25).toFixed(2)); // 125% premium = 25% extra
        const grossPay = Number((basicPay + overtimePay).toFixed(2));

        // Monthly salary for statutory computation
        const monthlySalaryForStatutory = s.pay_basis === 'monthly' ? monthlySalary : (dailyRate * 261 / 12);

        // SSS (employee: 5% of MSC, employer: 9.75% of MSC) — semi-monthly = half
        const msc = getSSSMSC(monthlySalaryForStatutory);
        const sssEmployee = Number((msc * SSS_RATES.EMPLOYEE / 2).toFixed(2));
        const sssEmployer = Number((msc * SSS_RATES.EMPLOYER / 2).toFixed(2));

        // PhilHealth (5% total, split 50/50 employee/employer) — semi-monthly
        const philHealthBase = Math.min(Math.max(monthlySalaryForStatutory, 10000), 100000);
        const philhealthEmployee = Number((philHealthBase * 0.025 / 2).toFixed(2));
        const philhealthEmployer = Number((philHealthBase * 0.025 / 2).toFixed(2));

// Pag-IBIG (1% employee up to MSC ₱5,000, 2% employer up to MSC ₱5,000) — semi-monthly
  // Employee rate: 1% for salary ≤ ₱5,000; 2% for salary > ₱5,000
  const pagIbigBase = Math.min(monthlySalaryForStatutory, 5000);
  const pagibigEmployeeRate = monthlySalaryForStatutory <= 5000 ? 0.01 : 0.02;
  const pagibigEmployee = Number((pagIbigBase * pagibigEmployeeRate / 2).toFixed(2));
  const pagibigEmployer = Number((pagIbigBase * 0.02 / 2).toFixed(2));

        // Semi-monthly taxable income for withholding tax
        const semiMonthlyTaxable = grossPay - sssEmployee - philhealthEmployee - pagibigEmployee;
        const withholdingTax = Number(computeWithholdingTax(semiMonthlyTaxable).toFixed(2));

        // Total deductions
        const totalDeductions = Number((sssEmployee + philhealthEmployee + pagibigEmployee + withholdingTax).toFixed(2));
        const netPay = Number((grossPay - totalDeductions).toFixed(2));

        entries.push({
          payroll_period_id: id,
          staff_id: s.id,
          total_hours: totalHours,
          regular_hours: regularHours,
          overtime_hours: overtimeHours,
          holiday_hours: 0,
          rest_day_hours: 0,
          night_diff_hours: 0,
          late_minutes: 0,
          basic_pay: basicPay,
          overtime_pay: overtimePay,
          holiday_pay: 0,
          night_differential_pay: 0,
          rest_day_pay: 0,
          allowances: 0,
          bonuses: 0,
          gross_pay: grossPay,
          sss_employee: sssEmployee,
          philhealth_employee: philhealthEmployee,
          pagibig_employee: pagibigEmployee,
          withholding_tax: withholdingTax,
          absence_deductions: 0,
          other_deductions: 0,
          total_deductions: totalDeductions,
          net_pay: netPay,
          sss_employer: sssEmployer,
          philhealth_employer: philhealthEmployer,
          pagibig_employer: pagibigEmployer,
        });
      }

      // Upsert entries
      for (const entry of entries) {
        await pool.query(`
          INSERT INTO payroll_entries (
            payroll_period_id, staff_id,
            total_hours, regular_hours, overtime_hours, holiday_hours, rest_day_hours, night_diff_hours, late_minutes,
            basic_pay, overtime_pay, holiday_pay, night_differential_pay, rest_day_pay, allowances, bonuses, gross_pay,
            sss_employee, philhealth_employee, pagibig_employee, withholding_tax, absence_deductions, other_deductions, total_deductions,
            net_pay, sss_employer, philhealth_employer, pagibig_employer,
            computed_at
          ) VALUES (
            ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            NOW()
          )
          ON DUPLICATE KEY UPDATE
            total_hours=VALUES(total_hours), regular_hours=VALUES(regular_hours), overtime_hours=VALUES(overtime_hours),
            holiday_hours=VALUES(holiday_hours), rest_day_hours=VALUES(rest_day_hours), night_diff_hours=VALUES(night_diff_hours), late_minutes=VALUES(late_minutes),
            basic_pay=VALUES(basic_pay), overtime_pay=VALUES(overtime_pay), holiday_pay=VALUES(holiday_pay),
            night_differential_pay=VALUES(night_differential_pay), rest_day_pay=VALUES(rest_day_pay), allowances=VALUES(allowances), bonuses=VALUES(bonuses),
            gross_pay=VALUES(gross_pay),
            sss_employee=VALUES(sss_employee), philhealth_employee=VALUES(philhealth_employee), pagibig_employee=VALUES(pagibig_employee),
            withholding_tax=VALUES(withholding_tax), absence_deductions=VALUES(absence_deductions), other_deductions=VALUES(other_deductions),
            total_deductions=VALUES(total_deductions), net_pay=VALUES(net_pay),
            sss_employer=VALUES(sss_employer), philhealth_employer=VALUES(philhealth_employer), pagibig_employer=VALUES(pagibig_employer),
            computed_at=NOW()
        `, [
          entry.payroll_period_id, entry.staff_id,
          entry.total_hours, entry.regular_hours, entry.overtime_hours, entry.holiday_hours, entry.rest_day_hours, entry.night_diff_hours, entry.late_minutes,
          entry.basic_pay, entry.overtime_pay, entry.holiday_pay, entry.night_differential_pay, entry.rest_day_pay, entry.allowances, entry.bonuses, entry.gross_pay,
          entry.sss_employee, entry.philhealth_employee, entry.pagibig_employee, entry.withholding_tax, entry.absence_deductions, entry.other_deductions, entry.total_deductions,
          entry.net_pay, entry.sss_employer, entry.philhealth_employer, entry.pagibig_employer,
        ]);
      }

      // Update period status to 'computed'
      await pool.query("UPDATE payroll_periods SET status = 'computed' WHERE id = ?", [id]);

      // Return updated entries with staff info
      const [result] = await pool.query(`
        SELECT pe.*, s.name, s.role, s.initials, s.color, s.pay_basis, s.daily_rate, s.monthly_salary
        FROM payroll_entries pe
        JOIN staff s ON s.id = pe.staff_id
        WHERE pe.payroll_period_id = ?
        ORDER BY s.name
      `, [id]);

      res.json({ period: periods[0], entries: result });
    } catch (e) {
      console.error('[Payroll] POST /periods/:id/compute error:', e);
      res.status(500).json({ error: 'Failed to compute payroll' });
    }
  });

  // ── PUT /api/payroll/entries/:id — manually edit an entry ────────────
  router.put('/entries/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const allowedFields = [
      'basic_pay', 'overtime_pay', 'holiday_pay', 'night_differential_pay', 'rest_day_pay',
      'allowances', 'bonuses',
      'sss_employee', 'philhealth_employee', 'pagibig_employee', 'withholding_tax',
      'absence_deductions', 'other_deductions',
      'overtime_hours', 'regular_hours', 'total_hours', 'holiday_hours', 'rest_day_hours', 'night_diff_hours', 'late_minutes',
      'notes',
    ];
    try {
      const fields = [];
      const vals = [];
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) {
          fields.push(`${f} = ?`);
          vals.push(req.body[f]);
        }
      }
      if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });

      // Recalculate gross_pay and net_pay from the fields
      fields.push('gross_pay = COALESCE(basic_pay,0) + COALESCE(overtime_pay,0) + COALESCE(holiday_pay,0) + COALESCE(night_differential_pay,0) + COALESCE(rest_day_pay,0) + COALESCE(allowances,0) + COALESCE(bonuses,0)');
      fields.push('total_deductions = COALESCE(sss_employee,0) + COALESCE(philhealth_employee,0) + COALESCE(pagibig_employee,0) + COALESCE(withholding_tax,0) + COALESCE(absence_deductions,0) + COALESCE(other_deductions,0)');
      fields.push('net_pay = gross_pay - total_deductions');

      vals.push(id);
      await pool.query(`UPDATE payroll_entries SET ${fields.join(', ')} WHERE id = ?`, vals);
      const [rows] = await pool.query(`
        SELECT pe.*, s.name, s.role, s.initials, s.color, s.pay_basis, s.daily_rate, s.monthly_salary
        FROM payroll_entries pe
        JOIN staff s ON s.id = pe.staff_id
        WHERE pe.id = ?
      `, [id]);
      res.json(rows[0]);
    } catch (e) {
      console.error('[Payroll] PUT /entries/:id error:', e);
      res.status(500).json({ error: 'Failed to update payroll entry' });
    }
  });

  // ── GET /api/payroll/staff-with-rates — staff list with payroll rates ──
  router.get('/staff-with-rates', authMiddleware, async (req, res) => {
    try {
      const [staff] = await pool.query(
        'SELECT id, name, role, initials, color, pay_basis, daily_rate, monthly_salary, sss_number, philhealth_number, pagibig_number, tin, tax_status, hire_date FROM staff ORDER BY name'
      );
      res.json(staff);
    } catch (e) {
      console.error('[Payroll] GET /staff-with-rates error:', e);
      res.status(500).json({ error: 'Failed to fetch staff payroll data' });
    }
  });

  // ── PUT /api/payroll/staff/:id — update staff payroll fields ──────────
  router.put('/staff/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const allowedFields = ['pay_basis', 'daily_rate', 'monthly_salary', 'sss_number', 'philhealth_number', 'pagibig_number', 'tin', 'tax_status', 'hire_date'];
    try {
      const fields = [];
      const vals = [];
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) {
          fields.push(`${f} = ?`);
          vals.push(req.body[f]);
        }
      }
      if (!fields.length) return res.status(400).json({ error: 'No valid fields to update' });
      vals.push(id);
      await pool.query(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`, vals);
      const [rows] = await pool.query(
        'SELECT id, name, role, initials, color, pay_basis, daily_rate, monthly_salary, sss_number, philhealth_number, pagibig_number, tin, tax_status, hire_date FROM staff WHERE id = ?',
        [id]
      );
      res.json(rows[0]);
    } catch (e) {
      console.error('[Payroll] PUT /staff/:id error:', e);
      res.status(500).json({ error: 'Failed to update staff payroll data' });
    }
  });

  return router;
}