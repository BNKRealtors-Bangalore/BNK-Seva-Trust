"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const databasePath = path.join(os.tmpdir(), `bnk-donations-${crypto.randomUUID()}.sqlite`);
process.env.DATABASE_PATH = databasePath;
process.env.TURSO_DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";
process.env.VERCEL = "";
process.env.RAZORPAY_KEY_SECRET = "test-secret";
const {
  captureDonation,
  initialize,
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

test.before(async () => { await initialize(); });

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

test("validates and normalizes the complete donation record", async () => {
  const donation = validateDonation(validDonation);
  assert.equal(donation.amountPaise, 250000);
  assert.equal(donation.email, "donor@example.org");
  assert.equal(donation.anonymous, 1);
});

test("rejects invalid amounts and unsupported categories", async () => {
  assert.throws(() => validateDonation({ ...validDonation, amount: 1.5 }), /Donation amount/);
  assert.throws(() => validateDonation({ ...validDonation, donationCategory: "Unknown" }), /category/);
});

test("accepts a matching checkout signature and rejects a forged one", async () => {
  const orderId = "order_test123";
  const paymentId = "pay_test123";
  const signature = crypto.createHmac("sha256", "test-secret").update(`${orderId}|${paymentId}`).digest("hex");
  assert.equal(verifyCheckoutSignature(orderId, paymentId, signature), true);
  assert.equal(verifyCheckoutSignature(orderId, paymentId, "f".repeat(64)), false);
});

test("reports zero temple fund progress before confirmed temple donations", async () => {
  assert.deepEqual(await templeFundSummary(), {
    raisedAmount: 0,
    goalAmount: 500000000,
    remainingAmount: 500000000,
    progress: 0
  });
});

test("saves sanitized pricing configuration for admin-managed amounts", async () => {
  const saved = await savePricingConfig({
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
  assert.deepEqual((await getPricingConfig()).sevaDonationAmounts, [101, 202, 303, 404, 505]);
});

test("saves admin site content and includes verified offline temple donations in fund totals", async () => {
  const saved = await saveSiteContent({
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
  assert.equal((await getSiteContent()).milestones[1].status, "In Progress");
  assert.equal((await templeFundSummary()).raisedAmount, 1200);
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
    assert.equal((await fetch(base+'/api/admin/site-content')).status,401);
    const privateContent=await fetch(base+'/api/admin/site-content',{headers:{Cookie:cookie}});assert.equal(privateContent.status,200);
    const publicResponse=await fetch(base+'/api/site-content');assert.equal(publicResponse.headers.get('x-frame-options'),'DENY');
    const publicContent = await publicResponse.json();
    for(const key of ['donations','csr','partners','volunteers','beneficiaries','users'])assert.equal(publicContent.records[key],undefined);
    assert.ok(!JSON.stringify(publicContent).includes('subscriber@example.org'));
    for (const route of ['/navbar-logo.css', '/teachings.html', '/support-story.html']) assert.equal((await fetch(base + route)).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("published store items are returned by the public API after authenticated saving", async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL||'bnksevatrust@gmail.com',password:process.env.ADMIN_PASSWORD||process.env.ADMIN_KEY||'admin'})});
    assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
    const existing=await (await fetch(base+'/api/site-content')).json();
    existing.records.store.push({id:'camphor-test',name:'Camphor',price:101,status:'Active',image:'images/logo.PNG'});
    const saved=await fetch(base+'/api/admin/site-content',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(existing)});
    assert.equal(saved.status,200);assert.ok((await saved.json()).records.store.some(item=>item.name==='Camphor'));
    const published=await (await fetch(base+'/api/site-content')).json();assert.ok(published.records.store.some(item=>item.name==='Camphor'&&item.status==='Active'));
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test("payment capture remains idempotent with asynchronous database transactions", async () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(databasePath);
  db.prepare("INSERT INTO donations (id, order_id, donor_name, mobile, email, donation_category, temple_seva, amount_paise, created_at, purpose, anonymous, status) VALUES ('capture-test', 'order_capture', 'Donor', '9999999999', 'donor@example.org', 'Seva', '', 50100, ?, 'Test', 0, 'pending')").run(new Date().toISOString());
  db.close();
  const first = await captureDonation('order_capture', 'pay_capture', 'upi', 50100);
  const second = await captureDonation('order_capture', 'pay_capture', 'upi', 50100);
  assert.equal(first.status, 'paid');
  assert.equal(second.receipt_number, first.receipt_number);
  await assert.rejects(captureDonation('order_capture', 'pay_other', 'upi', 50100), /different payment/);
  await assert.rejects(captureDonation('order_capture', 'pay_capture', 'upi', 100), /amount/);
});

test.after(() => {
  closeDatabase();
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(databasePath + suffix, { force: true });
  }
});
