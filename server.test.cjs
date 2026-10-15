"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const databasePath = path.join(os.tmpdir(), `bnk-donations-${crypto.randomUUID()}.sqlite`);
process.env.DATABASE_PATH = databasePath;
process.env.RAZORPAY_KEY_SECRET = "test-secret";
const {
  server,
  closeDatabase,
  getPricingConfig,
  getSiteContent,
  saveSiteContent,
  savePricingConfig,
  templeFundSummary,
  validateDonation,
  verifyCheckoutSignature
} = require("./server.cjs");

const validDonation = {
  donorName: "A Donor",
  mobile: "+919876543210",
  email: "donor@example.org",
  donationCategory: "Seva",
  amount: 2500,
  purpose: "Sponsor meals",
  anonymous: true,
  paymentMethod: "upi"
};

test("validates and normalizes the complete donation record", () => {
  const donation = validateDonation(validDonation);
  assert.equal(donation.amountPaise, 250000);
  assert.equal(donation.email, "donor@example.org");
  assert.equal(donation.anonymous, 1);
});

test("rejects invalid amounts and unsupported categories", () => {
  assert.throws(() => validateDonation({ ...validDonation, amount: 1.5 }), /Donation amount/);
  assert.throws(() => validateDonation({ ...validDonation, donationCategory: "Unknown" }), /category/);
});

test("accepts a matching checkout signature and rejects a forged one", () => {
  const orderId = "order_test123";
  const paymentId = "pay_test123";
  const signature = crypto.createHmac("sha256", "test-secret").update(`${orderId}|${paymentId}`).digest("hex");
  assert.equal(verifyCheckoutSignature(orderId, paymentId, signature), true);
  assert.equal(verifyCheckoutSignature(orderId, paymentId, "f".repeat(64)), false);
});

test("reports zero temple fund progress before confirmed temple donations", () => {
  assert.deepEqual(templeFundSummary(), {
    raisedAmount: 0,
    goalAmount: 500000000,
    remainingAmount: 500000000,
    progress: 0
  });
});

test("saves sanitized pricing configuration for admin-managed amounts", () => {
  const saved = savePricingConfig({
    contributionOptions: [{ sqft: 12, amount: 34567 }],
    sevaDonationAmounts: [101, 202, 303, 404, 505],
    specialSevaChalisa: [{ copies: 108, amount: "" }, { copies: 216, amount: 4200 }],
    sevaPartnerAmounts: [777, 888, 999],
    sponsorshipAmounts: { "temple-bell": 9000, "prayer-hall": "" },
    storePrices: { box: 7777 }
  });
  assert.deepEqual(saved.contributionOptions, [{ sqft: 12, amount: 34567 }]);
  assert.equal(saved.sponsorshipAmounts["temple-bell"], 9000);
  assert.equal(saved.sponsorshipAmounts["prayer-hall"], null);
  assert.equal(saved.storePrices.box, 7777);
  assert.deepEqual(saved.specialSevaChalisa, [{ copies: 108, amount: null }, { copies: 216, amount: 4200 }]);
  assert.deepEqual(saved.sevaPartnerAmounts, [777, 888, 999]);
  assert.deepEqual(getPricingConfig().sevaDonationAmounts, [101, 202, 303, 404, 505]);
});

test("saves admin site content and includes verified offline temple donations in fund totals", () => {
  const saved = saveSiteContent({
    records: {
      donations: [{ name: "Temple Donor", amount: 1200, type: "Temple Project", status: "Verified" }],
      stories: [{ name: "Published Story", status: "Published", quote: "Seva update" }],
      store: [{ name: "New Product", price: 501, status: "Active", image: "images/item.png" }]
    },
    milestones: [{ name: "Vision", status: "Completed" }, { name: "Land & Site", status: "In Progress" }],
    goal: 5000,
    templeNote: "Verified progress"
  });
  assert.equal(saved.records.donations[0].amount, 1200);
  assert.equal(saved.records.store[0].price, 501);
  assert.equal(getSiteContent().milestones[1].status, "In Progress");
  assert.equal(templeFundSummary().raisedAmount, 1200);
});

test("newsletter subscriptions validate, deduplicate, and stay private to authorized admins", async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (route, body) => fetch(base + route, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  try {
    assert.equal((await post('/api/newsletter/subscribe', {email: 'invalid'})).status, 400);
    assert.equal((await post('/api/newsletter/subscribe', {email: ' Subscriber@Example.org '})).status, 200);
    assert.equal((await post('/api/newsletter/subscribe', {email: 'subscriber@example.org'})).status, 200);
    assert.equal((await fetch(base + '/api/admin/newsletter')).status, 403);
    const login = await post('/api/admin/login', {email: process.env.ADMIN_EMAIL || 'bnksevatrust@gmail.com', password: process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY || 'admin'});
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const res = await fetch(base + '/api/admin/newsletter', {headers: {Cookie: cookie}});
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.subscribers.length, 1);
    assert.equal(data.subscribers[0].email, 'subscriber@example.org');
    assert.ok(data.subscribers[0].subscribedAt);
    const publicContent = await (await fetch(base + '/api/site-content')).json();
    assert.ok(!JSON.stringify(publicContent).includes('subscriber@example.org'));
    for (const route of ['/navbar-logo.css', '/teachings.html', '/support-story.html']) assert.equal((await fetch(base + route)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test.after(() => {
  closeDatabase();
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(databasePath + suffix, { force: true });
  }
});
