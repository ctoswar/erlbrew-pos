const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const { _test } = require("../index");

test("prices trusted catalog items in pesos", () => {
  const result = _test.priceItems([
    { id: "m1", qty: 2 },
    { id: "m6", qty: 1 },
  ]);
  assert.equal(result.total, 335);
  assert.deepEqual(result.items.map((item) => item.amount), [240, 95]);
});

test("ignores client-supplied prices and rejects unknown menu IDs", () => {
  const trusted = _test.priceItems([{ id: "m1", qty: 1, price: 0.01 }]);
  assert.equal(trusted.total, 120);
  assert.throws(
    () => _test.priceItems([{ id: "not-a-menu-item", qty: 1 }]),
    /invalid item/,
  );
});

test("verifies a fresh PayMongo signature and rejects tampering", () => {
  const secret = "webhook-secret-for-test";
  const rawBody = JSON.stringify({ data: { id: "evt_test" } });
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = crypto.createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  assert.equal(
    _test.verifyPayMongoSignature(rawBody, `t=${timestamp},te=${digest}`, secret),
    true,
  );
  assert.equal(
    _test.verifyPayMongoSignature(`${rawBody} `, `t=${timestamp},te=${digest}`, secret),
    false,
  );
});

test("finds webhook metadata through nested event data", () => {
  const event = {
    data: {
      type: "checkout_session.payment.paid",
      data: {
        id: "cs_test",
        type: "checkout_session",
        attributes: {
          reference_number: "EB-ORDER-1",
          payments: [{ attributes: { amount: 12000, status: "paid" } }],
        },
      },
      attributes: {
        data: {
          attributes: { metadata: { order_id: "EB-ORDER-1" } },
        },
      },
    },
  };
  assert.equal(_test.findMetadataValue(event, ["order_id"]), "EB-ORDER-1");
  assert.equal(_test.findPaymentAmount(event), 12000);
  assert.deepEqual(
    _test.webhookTransition("checkout_session.payment.paid"),
    { paymentStatus: "paid", status: "preparing" },
  );
});
