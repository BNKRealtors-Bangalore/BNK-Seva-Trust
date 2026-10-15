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
