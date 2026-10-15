# Reliability and deployment

## What continues to work

Website donations, purchases, newsletter subscriptions, volunteer forms, Seva Partner registrations, and CSR enquiries keep their existing endpoints and admin sections. QR payments remain **pending** until an authorized admin verifies them. Database records are never public website assets.

## Record migration and concurrent editing

On startup, the existing `site_content` document is migrated transactionally into `site_records`. The migration is idempotent, retains all existing records, and leaves the original JSON in `app_config` as a migration recovery source. There is no 200-record limit. Invalid legacy JSON fails startup rather than silently replacing records with defaults.

Normal admin record edits use a record endpoint. Admin publishing and record edits require the loaded database version. A newer submission or another admin save causes HTTP 409 instead of overwriting newer data. Use **Load Site**, review the latest records, and reapply the edit. That button asks before discarding local edits. Admin tables display 50 matching records per page; `/api/admin/records/:collection?offset=0&limit=50` also provides database pagination.

Create a database backup before deploying a migration. For a legacy database, use Turso's database export/backup controls before the first startup of this version. Do not roll back to an older application version that writes the legacy JSON: new records live in `site_records` after migration. Restore into a separate database and deploy a matching version if rollback is necessary.

For a pre-migration backup using the existing local Turso credentials, run `node scripts/turso-snapshot.cjs create`. This utility performs only a read transaction against Turso; it does not import the server or initialize/migrate the live database. It saves an encrypted SQL snapshot to `backups/*.sql.enc`, verifies an in-memory reconstruction, and stores a newly generated key in local `.env` if one is not already configured. Preserve the `BACKUP_ENCRYPTION_KEY` separately in a password manager. Verify an existing snapshot with `node scripts/turso-snapshot.cjs verify backups/<file>.sql.enc`. When recovery is needed, `node scripts/turso-snapshot.cjs decrypt backups/<file>.sql.enc backups/recovery.sql` writes the verified SQL only to the ignored backup folder. Import that SQL into a separate recovery database first. This pre-migration SQL format is distinct from the newer application-specific `.bnkbackup` format below.

## Stock and payment recovery

Blank stock means unlimited. `0` means unavailable. An order holds its quantities for 24 hours before payment reference submission. A submitted reference holds the quantities until verification or rejection. Verification deducts stock once and releases the hold; rejection releases the hold. Verified orders cannot be changed back to unverified: handle refunds separately to preserve payment history.

Existing unpaid/pending orders receive reservation rows during the one-time migration. Previously verified purchases are not retroactively deducted: reconcile current physical stock once before selling finite-stock products. Avoid reducing stock below outstanding reservations.

The payment recovery cookie is HttpOnly and SameSite Strict (Secure on Vercel). Browser session storage contains only the order ID, not customer details or the token. A **Resume payment** button restores checkout after a refresh in the same tab. The cookie lasts seven days; unpaid reservations expire after 24 hours. If someone already paid against an expired order, the message directs them to the Trust for manual reconciliation; do not pay twice.

## Certificate worker

Admin verification queues the certificate in the database. The admin page starts a separate worker request immediately after saving. SMTP is never called inside the record-save transaction. The scheduled maintenance route is a fallback if the browser closes or the immediate worker fails.

The worker uses atomic claims, a bounded batch, and two concurrent senders. Sending interrupted for more than five minutes becomes **Check mail provider**. An Admin must check the sender mailbox and explicitly choose **Confirm already sent** or **Retry after checking mailbox**; ambiguous sends are not automatically duplicated.

Set `SMTP_PASS` to a Gmail App Password for the configured `SMTP_USER`. Keep it Secret in Vercel; never put it in source code. Without SMTP configuration, certificates remain **Setup required** and records are still saved.

`vercel.json` schedules `/api/cron/maintenance` daily at 04:00 UTC. Set `CRON_SECRET` as a random Vercel Secret so Vercel can authenticate its requests. Daily scheduling is a fallback; normal verification starts the worker immediately. If verification volume grows, use a plan/scheduler that supports more frequent runs. The route rejects unauthenticated callers and never returns donor data.

## Encrypted backups

Backups include business records, users/password hashes, certificate records, pricing/content settings, and audit history. Sessions and rate-limit counters are excluded. Backups use authenticated AES-256-GCM encryption. Restore invalidates all admin sessions.

Required settings:

| Variable | Purpose |
| --- | --- |
| `BACKUP_ENCRYPTION_KEY` | 32 cryptographically random bytes, encoded as base64 or 64 hex characters |
| `BACKUP_BLOB_STORE_ID` | A **separate private** Vercel Blob store ID |
| `BACKUP_BLOB_READ_WRITE_TOKEN` | Private-store token, if OIDC is not configured for that store |
| `CRON_SECRET` | Authenticates scheduled maintenance |

Do not reuse the public image store for backups. Connect the private store to the project without replacing the image-upload store settings. The backup implementation specifies the private store ID explicitly. Save keys/tokens as Secrets and keep a secure separate copy of the encryption key. A lost key makes backups unrecoverable.

The daily maintenance job creates an encrypted private backup when configured. Admin **Backups & Audit** shows configuration state and the latest backup/maintenance status, and allows an immediate backup. Missing credentials are shown as **Setup required**, not as a completed backup. Watch Vercel Cron/Function logs for failures. Apply a retention policy to the private store according to the Trust's needs; this implementation retains backups instead of deleting them automatically.

Local encrypted backup:

```powershell
npm.cmd run backup
npm.cmd run backup:verify -- backups/<file>.bnkbackup
```

Restore drill (run with `DATABASE_PATH` pointing at a **separate disposable database** and `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` empty):

```powershell
npm.cmd run backup:restore -- backups/<file>.bnkbackup --confirm-restore
```

The restore command replaces records in its configured database. Verify the backup first, test restoring into a separate database, then check admin login, record counts, purchases, and certificates before any real recovery. Backups, secrets, and test screenshots are ignored by Git and excluded from deployment.

## Audit and validation

Admin **Backups & Audit** lists actor ID, timestamp, action, and affected record. Record saves/deletions, content publishing, pricing/user changes, purchase verification/rejection, certificate operations, and backups are logged. Passwords, access tokens, addresses, and payment payloads are not written to the audit log.

QR submissions validate email, phone, category, amount, and normalized transaction references. Duplicate QR donation/purchase references are rejected. New admin passwords and password changes both require 12–256 characters. CSV exports neutralize formula-leading cells before quoting.

## Frontend assets and verification

Edit `assets/index/*.js`, `assets/index/*.css`, and `assets/admin/*` directly. The extracted files preserve document execution order. `scripts/extract-page-assets.cjs` was a migration utility, not a required build step.

Run `npm.cmd run optimize:images` when adding large photos. It creates WebP variants and retains original artwork. Images inserted through admin are not automatically optimized by this offline tool. Use appropriately compressed uploads.

Public pages include canonical/Open Graph metadata and a sitemap. Admin is marked noindex. Fonts remain externally hosted; the browser smoke test intentionally blocks font requests to work offline.

Validation:

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
npm.cmd audit
```

Browser smoke uses Chrome on Windows and a disposable local database. It sends no real email or payment and touches no production records.
