# BNK Seva Trust donations

The site and donation API run together on one Node.js server. The API creates Razorpay orders, stores the donor's details in SQLite, verifies the checkout signature and captured payment with Razorpay, and assigns a sequential receipt number only after capture. A confirmed receipt is shown for printing or saving; email delivery is enabled when SMTP is configured.

## Run locally

Requires Node.js 22.5 or later. In PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npm test
npm start
```

The site is served at `http://127.0.0.1:3000`. Add Razorpay test credentials to `.env` to use test checkout. Never commit `.env` or expose the Razorpay secret in browser code. Until credentials are configured, the payment API remains disabled.

## Production setup

1. Complete the Trust's Razorpay onboarding and configure its approved payment methods. UPI, cards, net banking, and other methods are shown according to the merchant account and Razorpay Checkout availability.
2. Configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a separate `RAZORPAY_WEBHOOK_SECRET` in the server environment. Keep `DATABASE_PATH` on persistent storage and back it up with appropriate access controls.
3. Register `https://<trust-domain>/api/webhooks/razorpay` in Razorpay and subscribe to `payment.captured`.
4. Configure an authenticated SMTP relay (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) if receipts should also be emailed. Without SMTP, the verified receipt is still displayed for printing or saving after checkout.
5. Have the Trust's authorized adviser confirm the receipt wording, donor-data retention/access policy, and whether any separate statutory or tax-exemption certificate applies before issuing such certificates. The default acknowledgement makes no tax-deductibility representation.

Donation records include donor name, mobile, email, category, amount, provider payment reference, payment date, receipt number, purpose, and anonymous/public preference. The selected seva or sponsorship is carried in the donation purpose. Payment status remains pending until a captured payment is verified; failed or abandoned checkouts do not receive receipts.
Email subscriptions are saved in SQLite through `POST /api/newsletter/subscribe`. Admin and Editor users can review the private list under **Email Subscribers** in the admin panel. New admin accounts default to `Bnksevatrust@gmail.com`; the original `admin@bnk.local` placeholder account is migrated without changing its password unless `ADMIN_EMAIL` is explicitly configured. Set `ADMIN_PASSWORD` before first startup. Newsletter capture works without SMTP; sending newsletters requires a separate mailing workflow and configured mail credentials. The footer contact is `Bnksevatrust@gmail.com`.

## Vercel deployment

The repository includes a Vercel Function for all /api routes and a build step that publishes only website assets. Local SQLite remains available for local development. On Vercel the app requires a persistent Turso/libSQL database; it deliberately does not use temporary local storage.

1. Create a database at https://turso.tech and obtain its database URL and authentication token.
2. In Vercel project Settings ? Environment Variables, set TURSO_DATABASE_URL (libsql://...), TURSO_AUTH_TOKEN, ADMIN_EMAIL (Bnksevatrust@gmail.com), ADMIN_NAME (BNK Admin), and ADMIN_PASSWORD (a unique password). These values must be set for the deployment environment you use. Do not prefix them with NEXT_PUBLIC_.
3. Use the Other framework preset and the repository's vercel.json settings. The build command is node scripts/build-static.cjs and the output directory is public. Use Node.js 24.x. Clear any old dashboard overrides that conflict with these settings.
4. Redeploy, then visit /api/health. A successful database initialization returns {"ok":true}. Missing database credentials return a JSON error with HTTP 503. Sign in at /admin.html using ADMIN_EMAIL and ADMIN_PASSWORD.
5. For admin image uploads, connect a public Vercel Blob store under Storage; Vercel automatically configures BLOB_STORE_ID and OIDC authentication. Existing BLOB_READ_WRITE_TOKEN connections also work. Redeploy after connecting the store. Existing image URL fields work without this optional store. Add SMTP and Razorpay credentials only when you need those services.

Database tables and the first admin account are created automatically. Changing ADMIN_PASSWORD after the account exists does not reset it; change the password under Users & Roles. Existing local records are not copied to Turso automatically. Keep .env, database files, and tokens out of Git. Preview deployments should use a separate database and credentials from production.

Store checkout uses its own purchase form and private purchases table. POST /api/purchases saves contact/delivery details and server-priced product snapshots before showing the UPI QR. The customer submits a UPI reference using an order-specific payment token; this marks the purchase Pending Verification, not paid. Admins can review items, quantities, customer details, totals, and references in Purchases. Admin/Editor users can verify or reject references. Purchases are separate from donations and are never included in the public site-content response.

## Email donation certificates

After an admin marks a donation Verified, its Certificate of Seva is emailed to the donor with an SVG attachment and a private download link. Pending donations do not receive certificates. Admin Certificates shows queue status and allows retrying definite failures. Existing historical verified records are not bulk mailed automatically; an admin can explicitly issue one using Send certificate.

Gmail sender: Bnksevatrust@gmail.com. SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true, SMTP_USER=Bnksevatrust@gmail.com, SMTP_FROM=BNK Seva Trust <Bnksevatrust@gmail.com>. Set SMTP_PASS to a Gmail App Password after enabling Google 2-Step Verification. Enter it directly in local .env and Vercel Production environment variables, then restart/redeploy. Do not use the regular Gmail password or share the App Password in chat. PUBLIC_SITE_URL=https://bnksevatrust.vercel.app supplies the private download-link origin.

No WhatsApp sending is used. Submitted to email server means SMTP acceptance; inbox delivery is not guaranteed. Ambiguous transport failures are held for manual review to prevent duplicates. Credentials are never returned by an API.

## Data protection

The public content API returns only allowlisted public fields and published records. Full administrative records require a session at GET /api/admin/site-content. Admin browser storage retains only public content drafts; private records and password edits are not persisted there. Admin writes use session cookies, origin/content-type checks, and persistent request limits. Uploads accept signature-checked PNG/JPEG/WebP images; SVG uploads are rejected. Private responses and certificate links use no-store and no-referrer. Vercel adds anti-framing, HSTS, and browser security headers. Back up the private database separately with restricted access; do not publish backups in asset folders.


## Reliability and operations update

See OPERATIONS.md for migration, stock, encrypted backups, restore testing, certificate workers, and deployment configuration. Public submissions still appear in the same admin sections. Admin records now live in individual database rows with version checks and pagination.

Frontend source is in assets/index and assets/admin; edit those files directly. The HTML pages retain the same script execution order. Run npm run optimize:images after adding large photos, npm test, npm run test:browser (Chrome on Windows), and npm run build before deployment.
