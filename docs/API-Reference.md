# API Reference

Base URL: `http://localhost:3001/api`

---

## Authentication

### POST /staff/login

Authenticate staff member via RFID+PIN or username+password.

**Request Body:**
```json
{
  "rfid": "RF001",
  "pin": "1234"
}
```
OR
```json
{
  "username": "Luis Garcia",
  "password": "3456"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "clockAction": "clock_in"
}
```

---

## Menu

### GET /menu

Get all menu items (public).

**Response:**
```json
[
  {
    "id": "m1",
    "name": "Smoked Sea Salt Mocha",
    "category": "Signature Brews",
    "price": 6.75,
    "badge": "SIGNATURE",
    "description": "...",
    "emoji": "☕",
    "available": true
  }
]
```

---

## Orders

### GET /orders

Get all orders (public).

**Query Parameters:**
- `start` - Start date (YYYY-MM-DD)
- `end` - End date (YYYY-MM-DD)

**Response:**
```json
[
  {
    "id": "uuid",
    "status": "preparing",
    "subtotal": 12.50,
    "tax": 1.50,
    "total": 14.00,
    "type": "dine-in",
    "payMethod": "cash",
    "customerName": "Table 3",
    "createdAt": "2026-09-08T10:30:00Z",
    "staff": {
      "name": "Jane Dela Cruz",
      "initials": "JD"
    },
    "items": [...]
  }
]
```

### POST /orders

Create a new order (requires auth).

**Request Body:**
```json
{
  "staff_id": "RF001",
  "staff_name": "Jane Dela Cruz",
  "items": [
    {
      "id": "m1",
      "qty": 2,
      "price": 6.75,
      "notes": "Extra hot"
    }
  ],
  "type": "dine-in",
  "customer_name": "Table 3",
  "pay_method": "cash",
  "subtotal": 13.50,
  "tax": 1.62,
  "total": 15.12
}
```

**Response:**
```json
{
  "id": "new-uuid",
  "subtotal": 13.50,
  "tax": 1.62,
  "total": 15.12,
  "status": "preparing"
}
```

### PUT /orders/:id/status

Update order status (requires auth).

**Request Body:**
```json
{
  "status": "ready"
}
```

**Valid statuses:** `pending`, `preparing`, `ready`, `completed`

### DELETE /orders/:id

Void an order (admin only).

---

## Inventory

### GET /inventory

Get all inventory items (requires auth).

**Response:**
```json
[
  {
    "id": "milk-oat",
    "name": "Oat Milk 1L",
    "category": "Milk",
    "unit": "L",
    "stock": 24,
    "low_stock_threshold": 5,
    "purchase_cost": 4.50,
    "unit_cost": 4.50
  }
]
```

### POST /inventory

Create inventory item (admin only).

**Request Body:**
```json
{
  "id": "coffee-beans",
  "name": "Coffee Beans 1kg",
  "category": "Coffee",
  "unit": "kg",
  "stock": 10,
  "low_stock_threshold": 2,
  "purchase_cost": 25.00
}
```

---

## Staff

### GET /staff

Get all staff members (admin only).

### POST /staff

Create staff member (admin only).

**Request Body:**
```json
{
  "rfid": "RF005",
  "pin": "7890",
  "name": "New Staff",
  "role": "Barista",
  "initials": "NS",
  "color": "#4A90D9"
}
```

---

## Cash Drawer

### GET /cash-drawer

Get today's open cash drawer (requires auth).

### POST /cash-drawer

Open today's cash drawer (requires auth).

**Request Body:**
```json
{
  "opening_float": 5000.00
}
```

### PUT /cash-drawer/:id

Close cash drawer (requires auth).

**Request Body:**
```json
{
  "closing_amount": 15000.00,
  "cash_payouts": 500.00,
  "notes": "End of shift",
  "action": "close"
}
```

---

## Reports

### GET /orders/cogs

Get Cost of Goods Sold (requires auth).

**Query Parameters:**
- `start` - Start date
- `end` - End date

### POST /orders/z-report

Generate Z-Report (requires auth).

### GET /orders/z-reports

Get recent Z-Reports (requires auth).

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `NO_TOKEN` - Missing authentication
- `TOKEN_EXPIRED` - JWT expired
- `INVALID_TOKEN` - Invalid JWT
- `FORBIDDEN` - Insufficient permissions

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /staff/login | 10 requests/15 min |
| All other /api/* | 100 requests/min |
