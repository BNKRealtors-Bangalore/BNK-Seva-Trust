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
const { closeDatabase, templeFundSummary, validateDonation, verifyCheckoutSignature } = require("./server.cjs");

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

test.after(() => {
  closeDatabase();
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(databasePath + suffix, { force: true });
  }
});
