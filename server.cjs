"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const nodemailer = require("nodemailer");

const root = __dirname;

function loadEnvironment() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const entry = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!entry || entry[1] in process.env) continue;
    const value = entry[2].replace(/^(["'])(.*)\1$/, "$2");
    process.env[entry[1]] = value;
  }
}

loadEnvironment();

const keyId = process.env.RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
const databasePath = path.resolve(root, process.env.DATABASE_PATH || "./data/donations.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    donor_name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT NOT NULL,
    donation_category TEXT NOT NULL,
    temple_seva TEXT NOT NULL,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    payment_reference TEXT UNIQUE,
    payment_method TEXT,
    created_at TEXT NOT NULL,
    donation_date TEXT,
    receipt_number TEXT UNIQUE,
    purpose TEXT NOT NULL,
    anonymous INTEGER NOT NULL CHECK (anonymous IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid')),
    receipt_email_sent_at TEXT
  );
  CREATE INDEX IF NOT EXISTS donations_date_idx ON donations (donation_date);
  CREATE TABLE IF NOT EXISTS receipt_counters (
    year INTEGER PRIMARY KEY,
    value INTEGER NOT NULL
  );
`);

const donationCategories = new Set([
  "Temple Project",
  "Seva",
  "Sponsorship",
  "General Donation"
]);
const paymentMethods = new Set(["auto", "upi", "card", "netbanking", "other"]);
const maxBodyBytes = 20 * 1024;

function validateDonation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Please provide valid donation details.");
  }

  const donorName = typeof input.donorName === "string" ? input.donorName.trim() : "";
  const mobile = typeof input.mobile === "string" ? input.mobile.replace(/[\s()-]/g, "") : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const donationCategory = typeof input.donationCategory === "string" ? input.donationCategory.trim() : "";
  const purpose = typeof input.purpose === "string" ? input.purpose.trim() : "";
  const amount = Number(input.amount);

  if (!donorName || donorName.length > 120) throw new Error("Enter a valid donor name.");
  if (!/^\+?[0-9]{8,15}$/.test(mobile)) throw new Error("Enter a valid mobile number.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!donationCategories.has(donationCategory)) throw new Error("Select a valid donation category.");
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10000000) throw new Error("Donation amount must be between ₹1 and ₹1,00,00,000.");
  if (!purpose || purpose.length > 500) throw new Error("Enter a donation purpose of 500 characters or fewer.");
  if (typeof input.anonymous !== "boolean") throw new Error("Choose whether your name may be displayed publicly.");
  if (!paymentMethods.has(input.paymentMethod)) throw new Error("Select a supported payment method.");

  return {
    donorName,
    mobile,
    email,
    donationCategory,
    amountPaise: amount * 100,
    purpose,
    anonymous: input.anonymous ? 1 : 0,
    paymentMethod: input.paymentMethod
  };
}

function safeEqualHex(actual, expected) {
  if (typeof actual !== "string" || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

function verifyCheckoutSignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(signature, expected);
}

function sendJSON(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBodyBytes) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJSON(request) {
  const body = await readBody(request);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error("Request must contain valid JSON.");
  }
}

async function razorpayRequest(resource, options = {}) {
  if (!keyId || !keySecret) throw new Error("Online donations are not configured yet.");
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1${resource}`, {
    ...options,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("The payment provider could not complete this request.");
    error.statusCode = 502;
    throw error;
  }
  return result;
}

function publicReceipt(row) {
  return {
    receiptNumber: row.receipt_number,
    date: row.donation_date,
    donorName: row.donor_name,
    mobile: row.mobile,
    email: row.email,
    donationCategory: row.donation_category,
    amount: row.amount_paise / 100,
    paymentReference: row.payment_reference,
    paymentMethod: row.payment_method,
    purpose: row.purpose,
    anonymous: Boolean(row.anonymous)
  };
}

function templeFundSummary() {
  const goalAmount = Number(process.env.TEMPLE_FUND_GOAL_AMOUNT || 500000000);
  const total = database.prepare(`
    SELECT COALESCE(SUM(amount_paise), 0) AS amount_paise
    FROM donations
    WHERE status = 'paid' AND donation_category = 'Temple Project'
  `).get();
  const raisedAmount = total.amount_paise / 100;
  const safeGoal = Number.isFinite(goalAmount) && goalAmount > 0 ? Math.floor(goalAmount) : 500000000;
  const progress = Math.min(100, Math.max(0, (raisedAmount / safeGoal) * 100));
  return {
    raisedAmount,
    goalAmount: safeGoal,
    remainingAmount: Math.max(0, safeGoal - raisedAmount),
    progress
  };
}

function captureDonation(orderId, paymentId, paymentMethod, amountPaise) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const donation = database.prepare("SELECT * FROM donations WHERE order_id = ?").get(orderId);
    if (!donation) throw new Error("Donation order was not found.");
    if (donation.amount_paise !== amountPaise) throw new Error("The captured amount does not match the donation order.");
    if (donation.payment_reference && donation.payment_reference !== paymentId) throw new Error("A different payment has already been recorded for this donation.");

    if (donation.status !== "paid") {
      const year = new Date().getUTCFullYear();
      const counter = database.prepare(`
        INSERT INTO receipt_counters (year, value) VALUES (?, 1)
        ON CONFLICT (year) DO UPDATE SET value = value + 1
        RETURNING value
      `).get(year);
      const receiptNumber = `BNK/${year}/${String(counter.value).padStart(6, "0")}`;
      database.prepare(`
        UPDATE donations
        SET status = 'paid', payment_reference = ?, payment_method = ?,
            donation_date = ?, receipt_number = ?
        WHERE order_id = ?
      `).run(paymentId, paymentMethod || "Other", new Date().toISOString(), receiptNumber, orderId);
    }

    const paidDonation = database.prepare("SELECT * FROM donations WHERE order_id = ?").get(orderId);
    database.exec("COMMIT");
    return paidDonation;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function createMailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return null;
  const options = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true"
  };
  if (process.env.SMTP_USER) {
    options.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" };
  }
  return nodemailer.createTransport(options);
}

const mailTransport = createMailTransport();

async function emailReceipt(row) {
  if (!mailTransport || row.receipt_email_sent_at) return;
  const receipt = publicReceipt(row);
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(receipt.amount);
  const note = process.env.RECEIPT_POLICY_NOTE || "This receipt acknowledges the donation received. Any statutory or tax-exemption certificate is issued only where applicable under Trust policy and law.";
  const rows = [
    ["Receipt number", receipt.receiptNumber],
    ["Date", receipt.date],
    ["Donor", receipt.donorName],
    ["Donation category", receipt.donationCategory],
    ["Donation purpose", receipt.purpose],
    ["Amount", amount],
    ["Payment reference", receipt.paymentReference]
  ];
  await mailTransport.sendMail({
    from: process.env.SMTP_FROM,
    to: receipt.email,
    subject: `BNK Seva Trust donation receipt ${receipt.receiptNumber}`,
    text: `Your Seva has been received.\nThank you for becoming a part of this sacred journey.\n\n${rows.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\n${note}`,
    html: `<h1>Your Seva has been received.</h1><p>Thank you for becoming a part of this sacred journey.</p><table>${rows.map(([label, value]) => `<tr><th align="left">${escapeHTML(label)}</th><td>${escapeHTML(value)}</td></tr>`).join("")}</table><p>${escapeHTML(note)}</p>`
  });
  database.prepare("UPDATE donations SET receipt_email_sent_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
}

async function handleCreateOrder(request, response) {
  if (!keyId || !keySecret) {
    sendJSON(response, 503, { error: "Online donations are not configured yet. Please contact BNK Seva Trust." });
    return;
  }
  const donation = validateDonation(await readJSON(request));
  const donationId = crypto.randomUUID();
  const receipt = `BNK-${donationId.replaceAll("-", "").slice(0, 24)}`;
  const providerOrder = await razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: donation.amountPaise,
      currency: "INR",
      receipt,
      notes: {
        donation_id: donationId,
        category: donation.donationCategory,
        seva: donation.purpose
      }
    })
  });
  database.prepare(`
    INSERT INTO donations (
      id, order_id, donor_name, mobile, email, donation_category,
      temple_seva, amount_paise, created_at, purpose, anonymous, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    donationId,
    providerOrder.id,
    donation.donorName,
    donation.mobile,
    donation.email,
    donation.donationCategory,
    "",
    donation.amountPaise,
    new Date().toISOString(),
    donation.purpose,
    donation.anonymous
  );
  sendJSON(response, 201, { id: providerOrder.id, amount: providerOrder.amount, currency: providerOrder.currency });
}

async function handleVerifyPayment(request, response) {
  const input = await readJSON(request);
  const orderId = typeof input.orderId === "string" ? input.orderId : "";
  const paymentId = typeof input.paymentId === "string" ? input.paymentId : "";
  const signature = typeof input.signature === "string" ? input.signature : "";
  if (!orderId || orderId.length > 64 || !paymentId || paymentId.length > 64 || !verifyCheckoutSignature(orderId, paymentId, signature)) {
    sendJSON(response, 400, { error: "Payment verification failed. No receipt was issued." });
    return;
  }

  const donation = database.prepare("SELECT * FROM donations WHERE order_id = ?").get(orderId);
  if (!donation) {
    sendJSON(response, 404, { error: "Donation order was not found." });
    return;
  }
  const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if (payment.order_id !== orderId || payment.amount !== donation.amount_paise || payment.currency !== "INR") {
    sendJSON(response, 400, { error: "Payment details do not match this donation. No receipt was issued." });
    return;
  }
  if (payment.status !== "captured" || payment.captured !== true) {
    sendJSON(response, 202, { pending: true });
    return;
  }

  const paidDonation = captureDonation(orderId, paymentId, payment.method, payment.amount);
  try {
    await emailReceipt(paidDonation);
  } catch (error) {
    console.error("Receipt email delivery failed:", error.message);
  }
  sendJSON(response, 200, { receipt: publicReceipt(paidDonation) });
}

function validWebhookSignature(rawBody, signature) {
  if (!webhookSecret || typeof signature !== "string") return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(signature, expected);
}

async function handleWebhook(request, response) {
  const rawBody = await readBody(request);
  if (!validWebhookSignature(rawBody, request.headers["x-razorpay-signature"])) {
    sendJSON(response, 400, { error: "Invalid webhook signature." });
    return;
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    sendJSON(response, 400, { error: "Invalid webhook payload." });
    return;
  }
  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id || payment.currency !== "INR") {
      sendJSON(response, 400, { error: "Captured payment details are incomplete." });
      return;
    }
    try {
      const donation = captureDonation(payment.order_id, payment.id, payment.method, payment.amount);
      emailReceipt(donation).catch((error) => console.error("Receipt email delivery failed:", error.message));
    } catch (error) {
      console.error("Captured payment could not be recorded:", error.message);
      sendJSON(response, 500, { error: "Captured payment could not be recorded." });
      return;
    }
  }
  sendJSON(response, 200, { received: true });
}

function contentType(filePath) {
  return ({
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  })[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://localhost");
  try {
    if (url.pathname === "/api/payment-config" && request.method === "GET") {
      sendJSON(response, 200, {
        configured: Boolean(keyId && keySecret),
        keyId: keyId || null,
        receiptPolicyNote: process.env.RECEIPT_POLICY_NOTE || "This receipt acknowledges the donation received. Any statutory or tax-exemption certificate is issued only where applicable under Trust policy and law."
      });
      return;
    }
    if (url.pathname === "/api/temple-fund" && request.method === "GET") {
      sendJSON(response, 200, templeFundSummary());
      return;
    }
    if (url.pathname === "/api/donations/order" && request.method === "POST") {
      await handleCreateOrder(request, response);
      return;
    }
    if (url.pathname === "/api/payments/verify" && request.method === "POST") {
      await handleVerifyPayment(request, response);
      return;
    }
    if (url.pathname === "/api/webhooks/razorpay" && request.method === "POST") {
      await handleWebhook(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJSON(response, 405, { error: "Method not allowed." });
      return;
    }

    const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(root, `.${requestedPath}`);
    const relativePath = path.relative(root, filePath);
    const isPublicAsset = [
      "index.html",
      "privacy-policy.html",
      "terms-and-conditions.html",
      "donation-policy.html",
      "refund-policy.html",
      "statutory-information.html",
      "donation.css",
      "donation.js"
    ].includes(relativePath) ||
      relativePath.startsWith(`images${path.sep}`);
    if (!filePath.startsWith(`${root}${path.sep}`) || !isPublicAsset) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat?.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentType(filePath),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    const statusCode = error.statusCode || (error.message === "Request is too large." ? 413 : 400);
    sendJSON(response, statusCode, { error: error.message || "The request could not be completed." });
  }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () => {
    console.log(`BNK Seva Trust running at http://${host}:${port}`);
    if (!keyId || !keySecret) console.log("Payments are disabled until Razorpay credentials are configured in .env.");
  });
}

module.exports = {
  server,
  closeDatabase: () => database.close(),
  validateDonation,
  verifyCheckoutSignature,
  templeFundSummary
};
