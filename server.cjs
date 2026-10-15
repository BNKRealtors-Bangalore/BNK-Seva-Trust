"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createDatabase } = require("./database.cjs");
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
const database = createDatabase({ root });
const uploadDir = path.join(root, "uploads");
if (!process.env.VERCEL) fs.mkdirSync(uploadDir, { recursive: true });

const schema = `
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
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Editor', 'Viewer')),
    status TEXT NOT NULL CHECK (status IN ('Active', 'Disabled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    subscribed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

const defaultPricingConfig = {
  contributionOptions: [
    { sqft: 1, amount: 2500 },
    { sqft: 2, amount: 5000 },
    { sqft: 5, amount: 12500 },
    { sqft: 10, amount: 25000 },
    { sqft: 20, amount: 50000 },
    { sqft: 50, amount: 125000 },
    { sqft: 100, amount: 250000 }
  ],
  sponsorshipAmounts: {
    "temple-bell": null,
    "murti-sthapana": null,
    "prayer-hall": null,
    "temple-garden": null,
    "main-entrance": null,
    "marble-flooring": null,
    "temple-lighting": null,
    "anna-seva-kitchen": null,
    "water-facility": null,
    "spiritual-library": null,
    "community-hall": null,
    "satsang-space": null,
    "other-facilities": null
  },
  sevaDonationAmounts: [501, 1001, 2501, 5001, 11000],
  specialSevaChalisa: [
    { copies: 108, amount: 2100 },
    { copies: 216, amount: 4200 },
    { copies: 501, amount: null },
    { copies: 1008, amount: null }
  ],
  sevaPartnerAmounts: [501, 1001, 2501],
  storePrices: {
    box: 1499,
    frame: 499,
    chalisa: 299,
    books: 399,
    mala: 799,
    incense: 349,
    idol: 1499,
    merch: 599
  }
};

function sanitizePositiveInteger(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 ? amount : null;
}

function sanitizeNullableAmount(value) {
  if (value === null || value === "" || value === undefined) return null;
  return sanitizePositiveInteger(value);
}

function sanitizePricingConfig(input = {}) {
  const contributionOptions = Array.isArray(input.contributionOptions)
    ? input.contributionOptions
        .map((option) => ({
          sqft: sanitizePositiveInteger(option?.sqft),
          amount: sanitizePositiveInteger(option?.amount)
        }))
        .filter((option) => option.sqft && option.amount)
    : defaultPricingConfig.contributionOptions;

  const sponsorshipAmounts = { ...defaultPricingConfig.sponsorshipAmounts };
  if (input.sponsorshipAmounts && typeof input.sponsorshipAmounts === "object" && !Array.isArray(input.sponsorshipAmounts)) {
    for (const id of Object.keys(sponsorshipAmounts)) {
      sponsorshipAmounts[id] = sanitizeNullableAmount(input.sponsorshipAmounts[id]);
    }
  }

  const sevaDonationAmounts = Array.isArray(input.sevaDonationAmounts)
    ? input.sevaDonationAmounts.map(sanitizePositiveInteger).filter(Boolean).slice(0, 5)
    : defaultPricingConfig.sevaDonationAmounts;

  const storePrices = { ...defaultPricingConfig.storePrices };
  if (input.storePrices && typeof input.storePrices === "object" && !Array.isArray(input.storePrices)) {
    for (const id of Object.keys(storePrices)) {
      storePrices[id] = sanitizePositiveInteger(input.storePrices[id]) || storePrices[id];
    }
  }

  const specialSevaChalisa = Array.isArray(input.specialSevaChalisa)
    ? input.specialSevaChalisa
        .map((option) => ({
          copies: sanitizePositiveInteger(option?.copies),
          amount: sanitizeNullableAmount(option?.amount)
        }))
        .filter((option) => option.copies)
    : defaultPricingConfig.specialSevaChalisa;

  const sevaPartnerAmounts = Array.isArray(input.sevaPartnerAmounts)
    ? input.sevaPartnerAmounts.map(sanitizePositiveInteger).filter(Boolean).slice(0, 3)
    : defaultPricingConfig.sevaPartnerAmounts;

  return {
    contributionOptions: contributionOptions.length ? contributionOptions : defaultPricingConfig.contributionOptions,
    sponsorshipAmounts,
    sevaDonationAmounts: sevaDonationAmounts.length ? sevaDonationAmounts : defaultPricingConfig.sevaDonationAmounts,
    specialSevaChalisa: specialSevaChalisa.length ? specialSevaChalisa : defaultPricingConfig.specialSevaChalisa,
    sevaPartnerAmounts: sevaPartnerAmounts.length ? sevaPartnerAmounts : defaultPricingConfig.sevaPartnerAmounts,
    storePrices
  };
}

async function getPricingConfig() {
  const row = (await database.prepare("SELECT value FROM app_config WHERE key = ?").get("pricing"));
  if (!row) return defaultPricingConfig;
  try {
    return sanitizePricingConfig(JSON.parse(row.value));
  } catch {
    return defaultPricingConfig;
  }
}

async function savePricingConfig(input) {
  const config = sanitizePricingConfig(input);
  (await database.prepare(`
    INSERT INTO app_config (key, value, updated_at) VALUES ('pricing', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(config), new Date().toISOString()));
  return config;
}

const defaultInitiatives = [
  {
    id: "initiative_medical_camp",
    campaignName: "Free Medical Camp",
    name: "Free Medical Camp",
    location: "Newtown, Kolkata",
    date: "2026-10-15",
    image: "images/medical-camp-event.jpg",
    status: "Active"
  },
  {
    id: "initiative_food_distribution",
    campaignName: "Food Distribution Drive",
    name: "Food Distribution Drive",
    location: "Siliguri",
    date: "2026-10-22",
    image: "images/food-distribution-event.jpg",
    status: "Active"
  },
  {
    id: "initiative_education_support",
    campaignName: "Educational Support Programme",
    name: "Educational Support Programme",
    location: "Bengaluru",
    date: "2026-11-02",
    image: "images/education-event.jpg",
    status: "Active"
  }
];

const defaultStories = [
  {
    id: "meal-memory",
    name: "A Meal That Became a Memory",
    quote: "For many, it was just a meal. For him, it was care, kindness and a reminder that he is not forgotten.",
    image: "images/stories-food.jpg",
    category: "Beneficiary",
    siteCategory: "food",
    status: "Published",
    link: "stories/meal-memory.html",
    layout: "featured"
  },
  {
    id: "child-dream",
    name: "The First Step Towards a Child's Dream",
    quote: "With a little support and encouragement, a brighter future begins.",
    image: "images/stories-education.jpg",
    category: "Beneficiary",
    siteCategory: "education",
    status: "Published",
    link: "stories/child-dream.html",
    layout: "standard"
  },
  {
    id: "temple-community",
    name: "Building a Temple, Building a Community",
    quote: "A sacred vision bringing people together through faith, compassion and collective seva.",
    image: "images/stories-temple.jpg",
    category: "Community Member",
    siteCategory: "temple",
    status: "Published",
    link: "stories/temple-community.html",
    layout: "wide"
  },
  {
    id: "healthcare-day",
    name: "A Day of Healthcare Seva",
    quote: "Compassionate healthcare and support for communities in need.",
    image: "images/stories-healthcare.jpg",
    category: "Beneficiary",
    siteCategory: "healthcare",
    status: "Published",
    link: "stories/healthcare-day.html",
    layout: "standard"
  },
  {
    id: "why-we-serve",
    name: "Why We Serve",
    quote: "The meaning of seva, shared through people who choose to help.",
    image: "images/stories-volunteers.jpg",
    category: "Volunteer",
    siteCategory: "volunteers",
    status: "Published",
    link: "stories/why-we-serve.html",
    layout: "standard"
  },
  {
    id: "babas-grace",
    name: "In Baba's Grace",
    quote: "Reflections on devotion, faith and the spiritual journey.",
    image: "images/stories-baba.jpg",
    category: "Community Member",
    siteCategory: "spiritual",
    status: "Published",
    link: "stories/babas-grace.html",
    layout: "standard"
  },
  {
    id: "community-together",
    name: "The Strength of Togetherness",
    quote: "How collective acts of kindness can bring a community closer.",
    image: "images/stories-community.jpg",
    category: "Community Member",
    siteCategory: "community",
    status: "Published",
    link: "stories/community-together.html",
    layout: "standard"
  },
  {
    id: "greener-tomorrow",
    name: "A Greener Tomorrow",
    quote: "Small steps towards a more sustainable and caring world.",
    image: "images/stories-environment.jpg",
    category: "Community Member",
    siteCategory: "environment",
    status: "Published",
    link: "stories/greener-tomorrow.html",
    layout: "wide"
  },
  {
    id: "journey-of-service",
    name: "A Journey of Service",
    quote: "The people and values behind an enduring commitment to seva.",
    image: "images/stories-service.jpg",
    category: "Volunteer",
    siteCategory: "volunteers",
    status: "Published",
    link: "stories/journey-of-service.html",
    layout: "standard"
  }
];

const defaultSiteContent = {
  records: {
    donations: [],
    initiatives: defaultInitiatives,
    updates: [],
    store: [],
    stories: defaultStories,
    csr: [],
    partners: [],
    volunteers: [],
    beneficiaries: [],
    users: []
  },
  milestones: [
    "Vision",
    "Land & Site",
    "Architectural Design",
    "Approvals",
    "Ground Breaking",
    "Foundation",
    "Construction",
    "Murti Sthapana",
    "Pran Pratishtha"
  ].map((name, index) => ({ name, status: index === 0 ? "Completed" : "Upcoming" })),
  goal: 0,
  templeNote: ""
};

const siteRecordKeys = Object.keys(defaultSiteContent.records);
const milestoneStatuses = new Set(["Upcoming", "In Progress", "Completed"]);

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function sanitizeSiteRecord(record = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "amount" || key === "price" || key === "stock") {
      const numeric = Number(value);
      clean[key] = Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0;
    } else {
      clean[key] = cleanText(value, key === "quote" || key === "description" || key === "notes" ? 1000 : 220);
    }
  }
  clean.id = clean.id || `rec_${crypto.randomUUID()}`;
  return clean;
}

function sanitizeSiteContent(input = {}) {
  const records = {};
  for (const key of siteRecordKeys) {
    records[key] = Array.isArray(input.records?.[key])
      ? input.records[key].slice(0, 200).map(sanitizeSiteRecord)
      : [];
  }
  records.csr = records.csr.map((record) => ({
    ...record,
    organisation: record.organisation || record.name || "",
    contactName: record.contactName || record.contact || "",
    interest: record.interest || record.focus || "",
    name: record.name || record.organisation || "",
    contact: record.contact || record.contactName || "",
    focus: record.focus || record.interest || ""
  }));
  records.volunteers = records.volunteers.map((record) => ({
    ...record,
    areaOfInterest: record.areaOfInterest || record.activity || "",
    activity: record.activity || record.areaOfInterest || ""
  }));
  records.initiatives = records.initiatives.map((record) => ({
    ...record,
    campaignName: record.campaignName || record.name || "",
    name: record.name || record.campaignName || "",
    location: record.location || "",
    date: record.date || "",
    image: record.image || ""
  }));
  const milestones = Array.isArray(input.milestones)
    ? defaultSiteContent.milestones.map((fallback, index) => {
        const item = input.milestones[index] || {};
        return {
          name: cleanText(item.name || fallback.name, 80),
          status: milestoneStatuses.has(item.status) ? item.status : fallback.status
        };
      })
    : defaultSiteContent.milestones;
  const goal = Number(input.goal);
  return {
    records,
    milestones,
    goal: Number.isFinite(goal) && goal >= 0 ? Math.floor(goal) : 0,
    templeNote: cleanText(input.templeNote, 500)
  };
}

async function getSiteContent() {
  const row = (await database.prepare("SELECT value FROM app_config WHERE key = ?").get("site_content"));
  if (!row) return defaultSiteContent;
  try {
    return sanitizeSiteContent(JSON.parse(row.value));
  } catch {
    return defaultSiteContent;
  }
}

async function saveSiteContent(input) {
  const content = sanitizeSiteContent(input);
  (await database.prepare(`
    INSERT INTO app_config (key, value, updated_at) VALUES ('site_content', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(JSON.stringify(content), new Date().toISOString()));
  return content;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

async function appendPublicSubmission(type, input = {}) {
  return database.transaction(async () => {
  const content = await getSiteContent();
  const now = new Date().toISOString();
  let record;
  if (type === "csr") {
    record = {
      id: `csr_${crypto.randomUUID()}`,
      organisation: cleanText(input.organisation || input.name, 160),
      contactName: cleanText(input.contactName || input.contact, 120),
      email: cleanText(input.email, 254).toLowerCase(),
      interest: cleanText(input.interest || input.focus, 180),
      status: "Enquiry",
      phone: cleanText(input.phone, 40),
      budget: cleanText(input.budget, 120),
      message: cleanText(input.message, 1000),
      submittedAt: now
    };
    record.name = record.organisation;
    record.contact = record.contactName;
    record.focus = record.interest;
    if (!record.organisation || !record.contactName || !record.email || !record.interest) throw new Error("Please complete the CSR partner form.");
    content.records.csr.unshift(record);
  } else if (type === "partner") {
    record = {
      id: `partner_${crypto.randomUUID()}`,
      name: cleanText(input.name, 120),
      email: cleanText(input.email, 254).toLowerCase(),
      amount: sanitizePositiveInteger(input.amount),
      start: todayISODate(),
      status: "Active",
      phone: cleanText(input.phone, 40),
      city: cleanText(input.city, 120),
      submittedAt: now
    };
    if (!record.name || !record.email || !record.amount) throw new Error("Please complete the Seva Partner form.");
    content.records.partners.unshift(record);
  } else if (type === "volunteer") {
    record = {
      id: `volunteer_${crypto.randomUUID()}`,
      name: cleanText(input.name, 120),
      email: cleanText(input.email, 254).toLowerCase(),
      phone: cleanText(input.phone, 40),
      areaOfInterest: cleanText(input.areaOfInterest || input.activity, 180),
      status: "Active",
      city: cleanText(input.city, 120),
      availability: cleanText(input.availability, 120),
      submittedAt: now
    };
    record.activity = record.areaOfInterest;
    if (!record.name || !record.email || !record.phone || !record.areaOfInterest) throw new Error("Please complete the volunteer form.");
    content.records.volunteers.unshift(record);
  } else if (type === "donation") {
    const amount = sanitizePositiveInteger(input.amount);
    record = {
      id: `donation_${crypto.randomUUID()}`,
      name: cleanText(input.donorName || input.name, 120),
      amount,
      type: cleanText(input.donationCategory || input.type || "General Donation", 80),
      source: "UPI QR",
      date: todayISODate(),
      reference: cleanText(input.reference || input.paymentReference, 120),
      status: "Pending",
      phone: cleanText(input.mobile || input.phone, 40),
      email: cleanText(input.email, 254).toLowerCase(),
      purpose: cleanText(input.purpose, 500),
      visibility: cleanText(input.visibility, 40),
      submittedAt: now
    };
    if (!record.name || !record.phone || !record.email || !record.amount || !record.type || !record.reference) {
      throw new Error("Please complete the donation form and enter the UPI transaction reference.");
    }
    content.records.donations.unshift(record);
  } else {
    throw new Error("Unsupported submission type.");
  }
  await saveSiteContent(content);
  return record;
  });
}

async function isAuthorizedAdmin(request) {
  const expected = process.env.ADMIN_KEY;
  if (expected && (request.headers.authorization === `Bearer ${expected}` || request.headers["x-admin-key"] === expected)) return true;
  return Boolean(await getSessionUser(request, ["Admin", "Editor"]));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPassword(password, encoded) {
  const [scheme, iterations, salt, expectedHash] = String(encoded || "").split("$");
  if (scheme !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) return false;
  const actual = crypto.pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function publicAdminUser(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role, status: row.status };
}

async function ensureInitialAdminUser() {
  const count = (await database.prepare("SELECT COUNT(*) AS total FROM admin_users").get()).total;
  if (count) {
    // Upgrade the original placeholder account without changing its password or role.
    if (!process.env.ADMIN_EMAIL) {
      (await database.prepare("UPDATE admin_users SET email = ?, updated_at = ? WHERE email = 'admin@bnk.local' AND NOT EXISTS (SELECT 1 FROM admin_users WHERE email = ?)")
        .run("bnksevatrust@gmail.com", new Date().toISOString(), "bnksevatrust@gmail.com"));
    }
    return;
  }
  if (process.env.VERCEL && !process.env.ADMIN_PASSWORD) throw new Error("Set ADMIN_PASSWORD in Vercel environment variables before first deployment.");
  const now = new Date().toISOString();
  (await database.prepare(`
    INSERT INTO admin_users (id, name, email, password_hash, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Admin', 'Active', ?, ?)
  `).run(
    crypto.randomUUID(),
    process.env.ADMIN_NAME || "BNK Admin",
    (process.env.ADMIN_EMAIL || "Bnksevatrust@gmail.com").toLowerCase(),
    hashPassword(process.env.ADMIN_PASSWORD || process.env.ADMIN_KEY || "admin"),
    now,
    now
  ));
}

let initialization;
function initialize() {
  if (!initialization) initialization = (async () => {
    await database.exec(schema);
    await database.transaction(() => ensureInitialAdminUser());
  })().catch(error => { initialization = null; throw error; });
  return initialization;
}

function getCookie(request, name) {
  const cookies = String(request.headers.cookie || "").split(";").map((entry) => entry.trim());
  const pair = cookies.find((entry) => entry.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
}

function sessionCookie(token, expires) {
  return `bnk_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires.toUTCString()}${process.env.VERCEL ? '; Secure' : ''}`;
}

function clearSessionCookie() {
  return "bnk_admin_session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

async function getSessionUser(request, roles) {
  const token = getCookie(request, "bnk_admin_session");
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = (await database.prepare(`
    SELECT u.* FROM admin_sessions s
    JOIN admin_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'Active'
  `).get(tokenHash, new Date().toISOString()));
  if (!row || (roles && !roles.includes(row.role))) return null;
  return row;
}

const donationCategories = new Set([
  "Temple Project",
  "Seva",
  "Sponsorship",
  "Seva Store",
  "Seva Partner",
  "General Donation"
]);
const paymentMethods = new Set(["auto", "upi", "card", "netbanking", "other"]);
const maxBodyBytes = 6 * 1024 * 1024;
const uploadTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"]
]);

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

function sendJSON(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body);
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
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  const body = await readBody(request);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error("Request must contain valid JSON.");
  }
}

function parseMultipartFile(body, contentTypeHeader) {
  const boundaryMatch = String(contentTypeHeader || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Upload must use multipart/form-data.");
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  let start = body.indexOf(boundary);
  while (start !== -1) {
    const headerStart = start + boundary.length + 2;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd === -1) break;
    const headers = body.slice(headerStart, headerEnd).toString("utf8");
    const nameMatch = headers.match(/name="([^"]+)"/i);
    const filenameMatch = headers.match(/filename="([^"]*)"/i);
    const typeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
    const nextBoundary = body.indexOf(boundary, headerEnd + 4);
    if (nextBoundary === -1) break;
    if (nameMatch?.[1] === "image" && filenameMatch?.[1]) {
      return {
        filename: filenameMatch[1],
        contentType: (typeMatch?.[1] || "").trim().toLowerCase(),
        data: body.slice(headerEnd + 4, Math.max(headerEnd + 4, nextBoundary - 2))
      };
    }
    start = nextBoundary;
  }
  throw new Error("Choose an image file to upload.");
}

async function handleAdminImageUpload(request, response) {
  if (!await isAuthorizedAdmin(request)) {
    sendJSON(response, 401, { error: "Admin key required." });
    return;
  }
  try {
    const file = parseMultipartFile(await readBody(request), request.headers["content-type"]);
    const extension = uploadTypes.get(file.contentType);
    if (!extension) throw new Error("Upload a JPG, PNG, WebP or SVG image.");
    if (!file.data.length || file.data.length > 5 * 1024 * 1024) throw new Error("Image must be 5 MB or smaller.");
    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    if (process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
      if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)) throw new Error("Connect a public Vercel Blob store to this project and redeploy to enable image uploads.");
      const { put } = require("@vercel/blob");
      const blob = await put('uploads/' + filename, file.data, { access: "public", contentType: file.contentType });
      sendJSON(response, 200, { url: blob.url });
    } else {
      const filePath = path.join(uploadDir, filename);
      await fs.promises.writeFile(filePath, file.data, { flag: "wx" });
      sendJSON(response, 200, { url: '/uploads/' + filename });
    }
  } catch (error) {
    sendJSON(response, 400, { error: error.message || "Upload failed." });
  }
}

async function handleAdminLogin(request, response) {
  const input = await readJSON(request);
  const email = cleanText(input.email, 254).toLowerCase();
  const password = String(input.password || "");
  const user = (await database.prepare("SELECT * FROM admin_users WHERE email = ? AND status = 'Active'").get(email));
  if (!user || !verifyPassword(password, user.password_hash)) {
    sendJSON(response, 401, { error: "Invalid email or password." });
    return;
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 8);
  (await database.prepare(`
    INSERT INTO admin_sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(crypto.createHash("sha256").update(token).digest("hex"), user.id, expires.toISOString(), new Date().toISOString()));
  sendJSON(response, 200, { user: publicAdminUser(user) }, { "Set-Cookie": sessionCookie(token, expires) });
}

async function handleAdminLogout(request, response) {
  const token = getCookie(request, "bnk_admin_session");
  if (token) {
    (await database.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(crypto.createHash("sha256").update(token).digest("hex")));
  }
  sendJSON(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
}

async function adminUsers() {
  return (await database.prepare("SELECT id, name, email, role, status FROM admin_users ORDER BY created_at ASC").all());
}

async function handleSaveAdminUsers(request, response) {
  const actor = await getSessionUser(request, ["Admin"]);
  if (!actor) {
    sendJSON(response, 403, { error: "Admin role required." });
    return;
  }
  const input = await readJSON(request);
  const users = Array.isArray(input.users) ? input.users.slice(0, 50) : [];
  const now = new Date().toISOString();
  try {
    const savedUsers = await database.transaction(async () => {
    for (const user of users) {
      const email = cleanText(user.email, 254).toLowerCase();
      const name = cleanText(user.name, 120);
      const role = ["Admin", "Editor", "Viewer"].includes(user.role) ? user.role : "Viewer";
      const status = ["Active", "Disabled"].includes(user.status) ? user.status : "Active";
      if (!email || !name) continue;
      const existing = (await database.prepare("SELECT * FROM admin_users WHERE email = ?").get(email));
      if (existing) {
        (await database.prepare("UPDATE admin_users SET name = ?, role = ?, status = ?, updated_at = ? WHERE email = ?")
          .run(name, role, status, now, email));
        if (user.password) {
          if (typeof user.password !== "string" || user.password.length < 12 || user.password.length > 256) throw new Error("Use a password between 12 and 256 characters.");
          await database.prepare("UPDATE admin_users SET password_hash = ? WHERE email = ?").run(hashPassword(user.password), email);
          await database.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(existing.id);
        }
      } else {
        const password = cleanText(user.password, 120) || crypto.randomBytes(10).toString("base64url");
        (await database.prepare(`
          INSERT INTO admin_users (id, name, email, password_hash, role, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), name, email, hashPassword(password), role, status, now, now));
      }
    }
    const activeAdmins = (await database.prepare("SELECT COUNT(*) AS total FROM admin_users WHERE role = 'Admin' AND status = 'Active'").get()).total;
    if (!activeAdmins) throw new Error("At least one active Admin user is required.");
    return await adminUsers();
    });
    sendJSON(response, 200, { users: savedUsers });
  } catch (error) {
    sendJSON(response, 400, { error: error.message || "Could not save users." });
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

async function templeFundSummary() {
  const goalAmount = Number(process.env.TEMPLE_FUND_GOAL_AMOUNT || 500000000);
  const total = (await database.prepare(`
    SELECT COALESCE(SUM(amount_paise), 0) AS amount_paise
    FROM donations
    WHERE status = 'paid' AND donation_category = 'Temple Project'
  `).get());
  const siteContent = await getSiteContent();
  const offlineTempleAmount = siteContent.records.donations
    .filter((donation) => donation.status === "Verified" && ["Temple Project", "Temple by Sq. Ft."].includes(donation.type))
    .reduce((sum, donation) => sum + (Number(donation.amount) || 0), 0);
  const raisedAmount = total.amount_paise / 100 + offlineTempleAmount;
  const safeGoal = Number.isFinite(goalAmount) && goalAmount > 0 ? Math.floor(goalAmount) : 500000000;
  const progress = Math.min(100, Math.max(0, (raisedAmount / safeGoal) * 100));
  return {
    raisedAmount,
    goalAmount: safeGoal,
    remainingAmount: Math.max(0, safeGoal - raisedAmount),
    progress
  };
}

async function captureDonation(orderId, paymentId, paymentMethod, amountPaise) {
  try {
    return await database.transaction(async () => {
    const donation = (await database.prepare("SELECT * FROM donations WHERE order_id = ?").get(orderId));
    if (!donation) throw new Error("Donation order was not found.");
    if (donation.amount_paise !== amountPaise) throw new Error("The captured amount does not match the donation order.");
    if (donation.payment_reference && donation.payment_reference !== paymentId) throw new Error("A different payment has already been recorded for this donation.");

    if (donation.status !== "paid") {
      const year = new Date().getUTCFullYear();
      const counter = (await database.prepare(`
        INSERT INTO receipt_counters (year, value) VALUES (?, 1)
        ON CONFLICT (year) DO UPDATE SET value = value + 1
        RETURNING value
      `).get(year));
      const receiptNumber = `BNK/${year}/${String(counter.value).padStart(6, "0")}`;
      (await database.prepare(`
        UPDATE donations
        SET status = 'paid', payment_reference = ?, payment_method = ?,
            donation_date = ?, receipt_number = ?
        WHERE order_id = ?
      `).run(paymentId, paymentMethod || "Other", new Date().toISOString(), receiptNumber, orderId));
    }

    const paidDonation = (await database.prepare("SELECT * FROM donations WHERE order_id = ?").get(orderId));
    return paidDonation;
    });
  } catch (error) {
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
  (await database.prepare("UPDATE donations SET receipt_email_sent_at = ? WHERE id = ?").run(new Date().toISOString(), row.id));
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
  (await database.prepare(`
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
  ));
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

  const donation = (await database.prepare("SELECT * FROM donations WHERE order_id = ?").get(orderId));
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

  const paidDonation = await captureDonation(orderId, paymentId, payment.method, payment.amount);
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
      const donation = await captureDonation(payment.order_id, payment.id, payment.method, payment.amount);
      await emailReceipt(donation).catch((error) => console.error("Receipt email delivery failed:", error.message));
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
    await initialize();
    if (url.pathname === "/api/health" && request.method === "GET") {
      sendJSON(response, 200, { ok: true });
      return;
    }
    if (url.pathname === "/api/newsletter/subscribe" && request.method === "POST") {
      const input = await readJSON(request);
      const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJSON(response, 400, { error: "Enter a valid email address." });
        return;
      }
      (await database.prepare("INSERT INTO newsletter_subscribers (email, subscribed_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING")
        .run(email, new Date().toISOString()));
      sendJSON(response, 200, { ok: true, message: "Thank you for subscribing to BNK Seva updates." });
      return;
    }
    if (url.pathname === "/api/admin/newsletter" && request.method === "GET") {
      if (!await getSessionUser(request, ["Admin", "Editor"])) {
        sendJSON(response, 403, { error: "Admin or Editor role required." });
        return;
      }
      sendJSON(response, 200, { subscribers: (await database.prepare("SELECT email, subscribed_at AS subscribedAt FROM newsletter_subscribers ORDER BY subscribed_at DESC").all()) });
      return;
    }
    if (url.pathname === "/api/payment-config" && request.method === "GET") {
      sendJSON(response, 200, {
        configured: Boolean(keyId && keySecret),
        keyId: keyId || null,
        receiptPolicyNote: process.env.RECEIPT_POLICY_NOTE || "This receipt acknowledges the donation received. Any statutory or tax-exemption certificate is issued only where applicable under Trust policy and law."
      });
      return;
    }
    if (url.pathname === "/api/temple-fund" && request.method === "GET") {
      sendJSON(response, 200, await templeFundSummary());
      return;
    }
    if (url.pathname === "/api/pricing-config" && request.method === "GET") {
      sendJSON(response, 200, await getPricingConfig());
      return;
    }
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      await handleAdminLogin(request, response);
      return;
    }
    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      await handleAdminLogout(request, response);
      return;
    }
    if (url.pathname === "/api/admin/me" && request.method === "GET") {
      const user = await getSessionUser(request);
      if (!user) {
        sendJSON(response, 401, { error: "Login required." });
        return;
      }
      sendJSON(response, 200, { user: publicAdminUser(user) });
      return;
    }
    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      const user = await getSessionUser(request, ["Admin"]);
      if (!user) {
        sendJSON(response, 403, { error: "Admin role required." });
        return;
      }
      sendJSON(response, 200, { users: await adminUsers() });
      return;
    }
    if (url.pathname === "/api/admin/users" && request.method === "PUT") {
      await handleSaveAdminUsers(request, response);
      return;
    }
    if (url.pathname === "/api/site-content" && request.method === "GET") {
      sendJSON(response, 200, await getSiteContent());
      return;
    }
    const publicSubmissionMatch = url.pathname.match(/^\/api\/public-submissions\/(csr|partner|volunteer|donation)$/);
    if (publicSubmissionMatch && request.method === "POST") {
      try {
        sendJSON(response, 201, { ok: true, record: await appendPublicSubmission(publicSubmissionMatch[1], await readJSON(request)) });
      } catch (error) {
        sendJSON(response, 400, { error: error.message || "Submission could not be saved." });
      }
      return;
    }
    if (url.pathname === "/api/admin/pricing-config" && request.method === "PUT") {
      if (!await isAuthorizedAdmin(request)) {
        sendJSON(response, 401, { error: "Admin key required." });
        return;
      }
      sendJSON(response, 200, await savePricingConfig(await readJSON(request)));
      return;
    }
    if (url.pathname === "/api/admin/site-content" && request.method === "PUT") {
      if (!await isAuthorizedAdmin(request)) {
        sendJSON(response, 401, { error: "Admin key required." });
        return;
      }
      sendJSON(response, 200, await saveSiteContent(await readJSON(request)));
      return;
    }
    if (url.pathname === "/api/admin/upload-image" && request.method === "POST") {
      await handleAdminImageUpload(request, response);
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
      "admin.html",
      "donation.css",
      "navbar-logo.css",
      "teachings.html",
      "support-story.html",
      "donation.js"
    ].includes(relativePath) ||
      relativePath.startsWith(`stories${path.sep}`) ||
      relativePath.startsWith(`images${path.sep}`) ||
      relativePath.startsWith(`payment${path.sep}`) ||
      relativePath.startsWith(`uploads${path.sep}`);
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
    const type = contentType(filePath);
    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": type.startsWith("text/html") ? "no-store" : "public, max-age=3600",
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
  handleRequest,
  initialize,
  captureDonation,
  closeDatabase: () => database.close(),
  validateDonation,
  verifyCheckoutSignature,
  templeFundSummary,
  getPricingConfig,
  savePricingConfig,
  getSiteContent,
  saveSiteContent
};
