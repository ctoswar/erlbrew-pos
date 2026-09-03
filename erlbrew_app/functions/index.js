const crypto = require("node:crypto");

const { initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { defineSecret, defineString } = require("firebase-functions/params");

initializeApp();

const REGION = "asia-southeast1";
const PAYMONGO_API_URL = "https://api.paymongo.com/v2/checkout_sessions";
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;
const db = getFirestore();

const paymongoSecretKey = defineSecret("PAYMONGO_SECRET_KEY");
const paymongoWebhookSecret = defineSecret("PAYMONGO_WEBHOOK_SECRET");
const paymongoSuccessUrl = defineString("PAYMONGO_SUCCESS_URL", {
  default: "https://erlbrew.web.app/payment/success",
});
const paymongoCancelUrl = defineString("PAYMONGO_CANCEL_URL", {
  default: "https://erlbrew.web.app/payment/cancelled",
});

exports.awardCustomerPoints = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in as staff before awarding points.");
  }

  const staffSnapshot = await db.collection("users").doc(request.auth.uid).get();
  const staff = staffSnapshot.data() || {};
  if (staff.role !== "admin" && staff.isAdmin !== true) {
    throw new HttpsError("permission-denied", "Only staff can award points.");
  }

  const customerId = typeof request.data?.customer_id === "string"
    ? request.data.customer_id.trim()
    : "";
  const points = request.data?.points;
  if (!customerId || !Number.isSafeInteger(points) || points <= 0 || points > 10000) {
    throw new HttpsError("invalid-argument", "Provide a valid customer and points amount.");
  }

  const customerRef = db.collection("users").doc(customerId);
  return db.runTransaction(async (transaction) => {
    const customerSnapshot = await transaction.get(customerRef);
    if (!customerSnapshot.exists) {
      throw new HttpsError("not-found", "This customer account could not be found.");
    }

    const customer = customerSnapshot.data() || {};
    const currentPoints = Number.isSafeInteger(customer.points) ? customer.points : 0;
    const newBalance = currentPoints + points;
    const notificationRef = customerRef.collection("notifications").doc();

    transaction.update(customerRef, { points: newBalance });
    transaction.set(notificationRef, {
      type: "points_awarded",
      title: "Points received",
      message: `You received ${points} points at Erlbrew Café.`,
      points,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });

    return { new_balance: newBalance };
  });
});

// The client submits IDs and quantities only. Keep prices in trusted server
// code until the menu is migrated to an admin-controlled Firestore collection.
const MENU_CATALOG = Object.freeze({
  m1: { name: "Hot Brewed Coffee", price: 120 },
  m2: { name: "Cappuccino", price: 150 },
  m3: { name: "Caramel Macchiato", price: 165 },
  m4: { name: "Iced Matcha Latte", price: 170 },
  m5: { name: "Hot Matcha Latte", price: 160 },
  m6: { name: "Croissant", price: 95 },
  m7: { name: "Blueberry Muffin", price: 85 },
  m8: { name: "Pandesal Set", price: 60 },
});

function parameterValue(parameter) {
  try {
    return parameter.value();
  } catch (_) {
    return undefined;
  }
}

function validateRedirectUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw new HttpsError("failed-precondition", `${label} is not configured.`);
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new HttpsError("failed-precondition", `${label} is not configured.`);
  }
  return parsed.toString();
}

function priceItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 20) {
    throw new HttpsError("invalid-argument", "Add at least one valid menu item.");
  }

  const seen = new Set();
  const items = rawItems.map((rawItem) => {
    const id = typeof rawItem?.id === "string" ? rawItem.id.trim() : "";
    const quantity = rawItem?.qty;
    if (!id || seen.has(id) || !Number.isSafeInteger(quantity) ||
        quantity < 1 || quantity > 99 || !MENU_CATALOG[id]) {
      throw new HttpsError("invalid-argument", "The order contains an invalid item.");
    }
    seen.add(id);
    const catalogItem = MENU_CATALOG[id];
    return {
      id,
      name: catalogItem.name,
      quantity,
      unitPrice: catalogItem.price,
      amount: catalogItem.price * quantity,
    };
  });

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 1000000) {
    throw new HttpsError("invalid-argument", "The order total is invalid.");
  }
  return { items, total };
}

async function getCustomerProfile(uid, authToken) {
  const snapshot = await db.collection("users").doc(uid).get();
  const profile = snapshot.data() || {};
  const name = typeof profile.name === "string" && profile.name.trim()
    ? profile.name.trim()
    : (typeof authToken.name === "string" && authToken.name.trim()
      ? authToken.name.trim()
      : "Erlbrew User");
  const email = typeof profile.email === "string" && profile.email.trim()
    ? profile.email.trim()
    : (typeof authToken.email === "string" ? authToken.email.trim() : "");
  return { name, email };
}

async function createCheckout(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before placing an order.");
  }

  const paymentMethod = request.data?.payment_method;
  if (!["gcash", "qrph"].includes(paymentMethod)) {
    throw new HttpsError("invalid-argument", "Choose GCash or QRPh.");
  }

  const { items, total } = priceItems(request.data?.items);
  const secretKey = parameterValue(paymongoSecretKey);
  if (!secretKey) {
    throw new HttpsError("failed-precondition", "PayMongo checkout is not configured.");
  }

  const successUrl = validateRedirectUrl(
    parameterValue(paymongoSuccessUrl),
    "PAYMONGO_SUCCESS_URL",
  );
  const cancelUrl = validateRedirectUrl(
    parameterValue(paymongoCancelUrl),
    "PAYMONGO_CANCEL_URL",
  );
  const customer = await getCustomerProfile(request.auth.uid, request.auth.token);

  const orderRef = db.collection("orders").doc();
  const orderId = `EB-${orderRef.id.toUpperCase()}`;
  const paymongoResponse = await fetch(PAYMONGO_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: customer.email
            ? { name: customer.name, email: customer.email }
            : { name: customer.name },
          cancel_url: cancelUrl,
          description: `Erlbrew pickup order ${orderId}`,
          line_items: items.map((item) => ({
            currency: "PHP",
            amount: item.unitPrice * 100,
            name: item.name,
            quantity: item.quantity,
          })),
          metadata: {
            order_id: orderId,
            user_id: request.auth.uid,
            payment_method: paymentMethod,
          },
          payment_method_types: [paymentMethod],
          reference_number: orderId,
          send_email_receipt: false,
          success_url: successUrl,
        },
      },
    }),
  });
  const responseBody = await paymongoResponse.json().catch(() => null);
  if (!paymongoResponse.ok) {
    logger.error("PayMongo checkout creation failed", {
      status: paymongoResponse.status,
    });
    throw new HttpsError("internal", "PayMongo could not create checkout.");
  }

  const checkoutData = responseBody?.data;
  const checkoutSessionId = checkoutData?.id;
  const checkoutUrl = checkoutData?.attributes?.checkout_url;
  if (typeof checkoutSessionId !== "string" || typeof checkoutUrl !== "string") {
    logger.error("PayMongo returned an invalid checkout response");
    throw new HttpsError("internal", "PayMongo returned an invalid checkout.");
  }

  await orderRef.set({
    id: orderId,
    userId: request.auth.uid,
    customerName: customer.name,
    customerEmail: customer.email || null,
    items,
    total,
    currency: "PHP",
    paymentMethod,
    paymentStatus: "pending",
    status: "pending",
    checkoutSessionId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { order_id: orderId, checkout_url: checkoutUrl, total, currency: "PHP" };
}

function parseSignatureHeader(header) {
  if (typeof header !== "string") return null;
  const values = {};
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    values[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return values;
}

function verifyPayMongoSignature(rawBody, header, secret, now = Date.now()) {
  const values = parseSignatureHeader(header);
  const timestamp = Number(values?.t);
  const providedSignature = values?.te || values?.li;
  if (!Number.isSafeInteger(timestamp) || !providedSignature ||
      Math.abs(now / 1000 - timestamp) > SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  return expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function findMetadataValue(value, keys, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findMetadataValue(child, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key].trim();
    }
  }
  for (const child of Object.values(value)) {
    const found = findMetadataValue(child, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function findAmount(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return null;
  if (typeof value.amount === "number" && Number.isSafeInteger(value.amount)) {
    return value.amount;
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findAmount(child, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

function findPaymentAmount(event) {
  const resource = event?.data?.data || event?.data?.attributes?.data;
  const payments = resource?.attributes?.payments;
  return findAmount(payments) ?? findAmount(resource?.attributes || resource);
}

function webhookTransition(eventType) {
  if (eventType === "payment.paid" ||
      eventType === "checkout_session.payment.paid") {
    return { paymentStatus: "paid", status: "preparing" };
  }
  if (eventType === "payment.failed" ||
      eventType === "checkout_session.payment.failed") {
    return { paymentStatus: "failed", status: "cancelled" };
  }
  if (eventType === "payment.refunded") {
    return { paymentStatus: "cancelled", status: "cancelled" };
  }
  return null;
}

async function handleWebhook(request, response) {
  const secret = parameterValue(paymongoWebhookSecret);
  const rawBody = Buffer.isBuffer(request.rawBody)
    ? request.rawBody.toString("utf8")
    : null;
  const signature = request.get("paymongo-signature");
  if (!secret || !rawBody || !verifyPayMongoSignature(rawBody, signature, secret)) {
    response.status(400).json({ error: "Invalid webhook signature." });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (_) {
    response.status(400).json({ error: "Invalid webhook payload." });
    return;
  }
  const eventType = event?.data?.type || event?.data?.attributes?.type;
  const resourceId = event?.data?.data?.id || event?.data?.attributes?.data?.id;
  const eventId = event?.data?.id || resourceId;
  if (typeof eventId !== "string" || typeof eventType !== "string") {
    response.status(400).json({ error: "Invalid webhook event." });
    return;
  }

  const eventKey = `${eventType}:${eventId}`.replace(/[\/]/g, "_");
  const eventRef = db.collection("paymongoEvents").doc(eventKey);
  if ((await eventRef.get()).exists) {
    response.status(200).json({ received: true, duplicate: true });
    return;
  }

  const orderId = findMetadataValue(
    event,
    ["order_id", "orderId", "reference_number"],
  );
  const checkoutSessionId = findMetadataValue(
    event,
    ["checkout_session_id", "checkoutSessionId"],
  );
  const transition = webhookTransition(eventType);
  let orderRef = orderId ? db.collection("orders").doc(orderId) : null;
  if (!orderRef && checkoutSessionId) {
    const matching = await db.collection("orders")
      .where("checkoutSessionId", "==", checkoutSessionId)
      .limit(1)
      .get();
    if (!matching.empty) orderRef = matching.docs[0].ref;
  }

  const amountInCents = findPaymentAmount(event);
  await db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (eventSnapshot.exists) return;
    const orderSnapshot = orderRef ? await transaction.get(orderRef) : null;
    if (transition && !orderSnapshot?.exists) {
      throw new Error("PayMongo event did not match an order.");
    }
    if (transition && amountInCents !== null) {
      const expected = Number(orderSnapshot.data()?.total) * 100;
      if (amountInCents !== expected) {
        throw new Error("PayMongo amount did not match the order.");
      }
    }

    transaction.set(eventRef, {
      type: eventType,
      orderId: orderRef?.id || null,
      receivedAt: FieldValue.serverTimestamp(),
    });
    if (transition && orderSnapshot?.exists) {
      const current = orderSnapshot.data() || {};
      const update = { ...transition, updatedAt: FieldValue.serverTimestamp() };
      if (transition.paymentStatus === "paid" &&
          ["ready", "completed"].includes(current.status)) {
        delete update.status;
      }
      transaction.update(orderRef, update);
    }
  });

  response.status(200).json({ received: true });
}

async function getOrderStatus(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before checking an order.");
  }
  const orderId = request.data?.order_id;
  if (typeof orderId !== "string" || !orderId.trim()) {
    throw new HttpsError("invalid-argument", "An order ID is required.");
  }
  const snapshot = await db.collection("orders").doc(orderId.trim()).get();
  if (!snapshot.exists || snapshot.data()?.userId !== request.auth.uid) {
    throw new HttpsError("not-found", "Order not found.");
  }
  const data = snapshot.data();
  return {
    status: data.status || "pending",
    payment_status: data.paymentStatus || "pending",
  };
}

exports.createPayMongoCheckout = onCall(
  { region: REGION, secrets: [paymongoSecretKey] },
  createCheckout,
);
exports.getPayMongoOrderStatus = onCall({ region: REGION }, getOrderStatus);
exports.payMongoWebhook = onRequest(
  { region: REGION, secrets: [paymongoWebhookSecret] },
  handleWebhook,
);

exports._test = {
  findAmount,
  findPaymentAmount,
  findMetadataValue,
  parseSignatureHeader,
  priceItems,
  verifyPayMongoSignature,
  webhookTransition,
};
