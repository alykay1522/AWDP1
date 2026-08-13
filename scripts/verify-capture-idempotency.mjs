#!/usr/bin/env node
/**
 * Double-submit capture verification for the PayPal flow.
 *
 * Verifies the atomic `pending -> capturing` claim in
 * artifacts/api-server/src/routes/paypal.ts actually prevents a double capture
 * under concurrency. Before that guard existed, two simultaneous requests could
 * both read status "pending", both call PayPal, and the customer would see a 500
 * after being charged — with the fulfilment email sent twice.
 *
 * This cannot be fully automated: PayPal requires a human to approve the order
 * in a browser between create and capture. The script therefore runs in two
 * phases.
 *
 *   PHASE 1 — create an order and print the approval URL
 *     node scripts/verify-capture-idempotency.mjs create
 *
 *   ...open the printed approval URL, log into a PayPal SANDBOX buyer account,
 *   approve the payment, then stop at the return page. Do NOT let the page's own
 *   capture call run — copy the ids from the URL/console instead.
 *
 *   PHASE 2 — fire two captures simultaneously
 *     node scripts/verify-capture-idempotency.mjs capture <paypalOrderId> <orderId>
 *
 * PASS CRITERIA (phase 2):
 *   - exactly ONE response with 200 { success: true } and no alreadyProcessed
 *   - the other is 409 "already being processed"  OR
 *     200 { alreadyProcessed: true } if it lost the race after the first finished
 *   - never two independent successes
 *   - never a 500
 * Then confirm in the DB that the order has exactly one capture and status
 * "paid", and that only one fulfilment email was sent.
 *
 * REQUIRED ENV:
 *   BASE_URL   e.g. https://your-preview.vercel.app   (default http://localhost:3000)
 * The API server must be running against PAYPAL_MODE=sandbox with sandbox creds.
 */

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const mode = process.argv[2];

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

async function readBody(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 400) };
  }
}

async function create() {
  // NOTE: sku must exist in the catalog, be inStock, and priced so the cart
  // clears the $50 server-side minimum. Adjust to a real SKU before running.
  const payload = {
    items: [{ sku: process.env.TEST_SKU ?? "AWDP-TEST-001", quantity: 1 }],
    customer: {
      name: "Idempotency Test",
      email: "sandbox-buyer@example.com",
      phone: "7855330244",
      address: {
        line1: "123 Test St",
        city: "Colorado Springs",
        state: "CO",
        postal_code: "80903",
        country: "US",
      },
    },
  };

  const res = await fetch(`${BASE_URL}/api/paypal/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readBody(res);

  if (!res.ok) {
    die(`create-order failed (HTTP ${res.status}): ${JSON.stringify(body)}`);
  }

  console.log("\n── PHASE 1 COMPLETE ─────────────────────────────────────────");
  console.log(`  local orderId   : ${body.orderId}`);
  console.log(`  paypalOrderId   : ${body.paypalOrderId}`);
  console.log(`  total           : $${body.total}`);
  console.log("\n  Approve in a browser (SANDBOX buyer account):");
  console.log(`  https://www.sandbox.paypal.com/checkoutnow?token=${body.paypalOrderId}`);
  console.log("\n  Then run:");
  console.log(`  node scripts/verify-capture-idempotency.mjs capture ${body.paypalOrderId} ${body.orderId}`);
  console.log("─────────────────────────────────────────────────────────────\n");
}

async function capture(paypalOrderId, orderId) {
  if (!paypalOrderId || !orderId) {
    die("usage: verify-capture-idempotency.mjs capture <paypalOrderId> <orderId>");
  }

  const send = (tag) =>
    fetch(`${BASE_URL}/api/paypal/capture-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paypalOrderId, orderId }),
    }).then(async (res) => ({ tag, status: res.status, body: await readBody(res) }));

  // Promise.all with no await between them: both requests are in flight before
  // either can complete, which is the condition the claim must survive.
  const results = await Promise.all([send("A"), send("B")]);

  console.log("\n── PHASE 2 RESULTS ──────────────────────────────────────────");
  for (const r of results) {
    console.log(`  [${r.tag}] HTTP ${r.status}  ${JSON.stringify(r.body)}`);
  }

  const freshSuccess = results.filter(
    (r) => r.status === 200 && r.body?.success === true && r.body?.alreadyProcessed !== true,
  );
  const benign = results.filter(
    (r) => r.status === 409 || (r.status === 200 && r.body?.alreadyProcessed === true),
  );
  const errors = results.filter((r) => r.status >= 500);

  console.log("─────────────────────────────────────────────────────────────");
  if (errors.length > 0) {
    die("FAIL: a request returned 5xx. A charged customer would see an error.");
  }
  if (freshSuccess.length !== 1) {
    die(`FAIL: expected exactly 1 fresh success, got ${freshSuccess.length}. Double capture is possible.`);
  }
  if (benign.length !== 1) {
    die(`FAIL: expected the loser to be 409 or alreadyProcessed, got ${JSON.stringify(benign)}`);
  }

  console.log("\n✔ PASS: exactly one capture succeeded; the concurrent duplicate was rejected cleanly.");
  console.log("\n  Now confirm manually:");
  console.log("   1. PayPal sandbox dashboard shows ONE capture for this order");
  console.log(`   2. SELECT status FROM orders WHERE order_id = '${orderId}';  -- expect 'paid'`);
  console.log("   3. Exactly ONE fulfilment email arrived\n");
}

if (mode === "create") {
  await create();
} else if (mode === "capture") {
  await capture(process.argv[3], process.argv[4]);
} else {
  die("usage: verify-capture-idempotency.mjs create | capture <paypalOrderId> <orderId>");
}
