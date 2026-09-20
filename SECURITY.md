# Security Policy

## Overview

Erlbrew POS is a point-of-sale system that handles payment processing, staff authentication (RFID + PIN), and business transaction data. Security is critical — a breach could expose payment information, staff credentials, and sales records.

## Supported Versions

| Version | Supported | Notes |
| ------- | --------- | ----- |
| 2.0.x   | :white_check_mark: | Current release — receives security patches |
| < 2.0   | :x: | End of life — upgrade immediately |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, email **delacruz.duncan@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce (proof of concept)
- The potential impact
- Any suggested fix (optional)

### What to expect

| Step | Timeline |
| ---- | -------- |
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Within 14 days for critical issues |
| Public disclosure | After fix is deployed and users have updated |

We will work with you to understand and resolve the issue before any public disclosure. If you report in good faith, we will not take legal action against you.

## Security Practices

### Authentication

- JWT tokens with `JWT_SECRET` (minimum 32 characters, randomly generated)
- Staff login rate-limited to **10 attempts per minute**
- RFID card + PIN two-factor authentication for staff operations
- Tokens stored in `localStorage` (not transmitted in cookies to avoid CSRF)

### Data Protection

- **Payment data**: We do not store credit card numbers, full e-wallet IDs, or payment credentials. Only payment method type and reference numbers are recorded.
- **Staff credentials**: PINs and RFID values are stored in the database. In a real deployment, PINs should be hashed (bcrypt) — this is a known hardening step.
- **Environment secrets**: `JWT_SECRET`, `DATABASE_URL`, and `GOOGLE_SERVICE_ACCOUNT_KEY` must never be committed to git. The `.env` file is gitignored.

### API Security

- All write endpoints require `Authorization: Bearer <token>` header
- Admin-only endpoints (staff delete, order void/refund, COGS reset) require `role: 'admin'`
- CORS restricted to configured origins via `CORS_ORIGINS` env var
- Input validation on all endpoints (required fields, type checks)
- Parameterized SQL queries — no string concatenation in queries

### Infrastructure

- HTTPS with self-signed certificates (dev) — use proper certificates in production
- Print server connection uses TLS (bypassed for self-signed certs only)
- Google Sheets integration uses service account with minimal permissions
- MySQL connection pooling with configurable limits

## Known Security Limitations

These are known areas for hardening. Contributions welcome:

1. **PIN hashing** — PINs are stored as plaintext in the database. Should use bcrypt/argon2.
2. **JWT expiration** — Tokens currently do not expire. Add `expiresIn` to JWT signing.
3. **Refresh tokens** — No refresh token rotation. Session management could be improved.
4. **HTTPS in production** — Self-signed certs are used for development. Production should use Let's Encrypt or equivalent.
5. **Rate limiting** — Only login is rate-limited. Other endpoints (order creation, etc.) should be too.
6. **Audit logging** — No centralized audit trail for admin actions (void, refund, staff delete).
7. **CSRF protection** — No CSRF tokens. Acceptable for API-only backend with JWT, but should be reconsidered if cookies are ever used.

## Environment Variables

The following must be kept secret and **never committed**:

| Variable | Purpose |
| -------- | ------- |
| `JWT_SECRET` | Signs authentication tokens (min 32 chars) |
| `DATABASE_URL` | MySQL connection string |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Google Sheets API credentials |
| `GOOGLE_SHEETS_ID` | Spreadsheet identifier (low risk but keep private) |

## Dependency Auditing

Run regularly:

```bash
npm audit
npm audit fix
```

Check for known vulnerabilities in both frontend and backend dependencies before deploying updates.

## Contact

For security concerns: **ctoswar@gmail.com**

For general issues and feature requests: [GitHub Issues](https://github.com/ctoswar/erlbrew-pos/issues)
