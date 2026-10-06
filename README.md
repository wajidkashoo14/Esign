# E-Sign — self-hosted electronic signatures

A single-owner e-signature app: draft an agreement, send unique signing links, collect typed or drawn
signatures with an audit trail, and produce a final PDF with a Certificate of Completion.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind 4 · Prisma (SQLite locally, Postgres in production) ·
pdf-lib · jose + bcryptjs · zod · Resend or SMTP (nodemailer).

## Features

- Owner login from env vars (`OWNER_EMAIL`, `OWNER_PASSWORD_HASH`), JWT in an httpOnly cookie, DB-backed login rate limit.
- Agreements: title, plain-text body with `{{variables}}`, reusable templates, signers with order, expiry date.
  Statuses: `draft → sent → partially_signed → completed`, plus `voided` and `expired`.
- Send: a 32-byte random token per signer; only its SHA-256 hash is stored. Parallel or sequential signing.
  Resend issues a fresh link and invalidates the old one.
- Signing page (no account): full text, ESIGN / IT Act consent box, typed signature (cursive font rendered to a PNG on a
  canvas) or drawn signature. The text is frozen at send time and its SHA-256 recorded.
- Audit events (created, sent, resent, viewed, signed, completed, voided, expired) with IP, user agent and UTC timestamp.
- Completion: final PDF with signature blocks and a Certificate of Completion (audit trail and document hash). The PDF's
  SHA-256 is stored, the PDF is emailed to all parties and the owner can download it.
- Dashboard with status filters, detail page with audit timeline, resend / void / download.

## Local setup (Windows PowerShell)

Requires Node.js 20+.

```powershell
git clone <this repo> ; cd Esign        # or open the existing folder
npm install
Copy-Item .env.example .env

# 1. Create the owner password hash and paste the printed OWNER_PASSWORD_HASH line into .env
npm run hash-password -- "choose a long password"

# 2. Create an AUTH_SECRET (48 random bytes) and paste it into .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Edit .env: OWNER_EMAIL, OWNER_PASSWORD_HASH, AUTH_SECRET, APP_URL (http://localhost:3000)

# 4. Create the SQLite database and start the app
npx prisma migrate deploy
npm run dev
```

Open <http://localhost:3000> and sign in. The database is `prisma/dev.db`.

> **Dollar signs in `.env`:** Next.js expands `$VAR` inside `.env` files, which corrupts bcrypt hashes. `npm run hash-password`
> prints the line already escaped (`\$2b\$12\$...`). Use the raw (unescaped) hash only in a hosting dashboard such as Vercel.

### Email

With no email variables set, nothing is sent: after sending/resending, the **signing links are shown in the UI** (once; only
hashes are stored) and, in development only, printed to the console. Configure one of:

| Provider | Variables |
| --- | --- |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` (a verified sender) |
| SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM` |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `typecheck` · `test` | ESLint · `tsc --noEmit` · `node:test` via `tsx` |
| `npm run check` | all three |
| `npm run db:migrate` | `prisma migrate dev` (create new migrations; then run `npm run db:sync-pg` and see below) |
| `npm run db:sync-pg` | regenerate `prisma/postgres/schema.prisma` from `prisma/schema.prisma` |
| `npm run hash-password -- "pw"` | bcrypt hash for `OWNER_PASSWORD_HASH` |

## Deploying to Vercel with Neon or Supabase

SQLite is for local use only (Vercel's filesystem is not persistent). Production uses Postgres from the same Prisma models:
`prisma/postgres/` holds a generated Postgres schema and its own migrations.

1. **Create a Postgres database.**
   - *Neon:* create a project; copy the **pooled** connection string (host contains `-pooler`) and the **direct** one.
   - *Supabase:* Project Settings → Database → connection strings: use the **transaction pooler** (port 6543, append
     `?pgbouncer=true`) for `DATABASE_URL` and the **direct / session** connection (port 5432) for `DIRECT_URL`.
2. **Push the repo to GitHub** and import it in Vercel (Framework: Next.js). Vercel runs the `vercel-build` script automatically:
   it generates the client from the Postgres schema, applies `prisma/postgres/migrations` with `migrate deploy`, then builds.
3. **Set environment variables** (Production): `DATABASE_URL`, `DIRECT_URL`, `OWNER_EMAIL`, `OWNER_PASSWORD_HASH` (raw hash, no
   backslashes), `AUTH_SECRET`, `APP_URL` (your https URL, no trailing slash), `EMAIL_FROM` and a Resend or SMTP provider.
4. Deploy, open the site, sign in, and send yourself a test agreement.

When you change `prisma/schema.prisma`: run `npm run db:migrate` (SQLite), then `npm run db:sync-pg`, then create the matching
Postgres migration:

```powershell
npx prisma migrate dev --schema prisma/postgres/schema.prisma --name <change> --create-only   # needs a scratch Postgres DB
```

(or write the SQL with `prisma migrate diff`). To use the Postgres client locally after running `vercel-build`, run
`npx prisma generate` again to switch back to the SQLite client.

Self-hosting elsewhere: `npm run build && npm start` behind a reverse proxy that **overwrites** `X-Forwarded-For`
(it is stored as the signer's IP) and terminates HTTPS.

## How it works

- **Tokens:** `crypto.randomBytes(32)` → base64url. Only `sha256(token)` is stored; verification re-hashes and compares with
  `timingSafeEqual`. A new token replaces the old one (resend); voiding clears all token hashes.
- **Document hash:** `sha256(JSON.stringify({v:1,title,body}))` of the text with variables substituted, recorded at send time and
  printed in the certificate. Anyone holding the text can recompute it.
- **Locking:** only `draft` agreements can be edited (enforced in the database update, not just the UI).
- **Concurrency:** signing, completion and void use conditional updates inside transactions, so double-submits and races
  (sign vs. void) cannot produce a second signature or an inconsistent status.
- **Sequential mode:** later signers get no link until the previous signer finishes; the next signer is emailed automatically.
  Without email, use **Get link** on the detail page.
- **Expiry:** checked on every read and materialised as `expired` (with an audit event).

## Security notes

- **CSRF:** all mutations are Next.js server actions (POST-only, origin-checked by Next) with `SameSite=Lax` cookies; the one
  owner GET route is read-only. Every action and route also re-checks the session (`requireOwner`) rather than trusting middleware.
- **Headers:** nonce-based Content-Security-Policy (middleware), HSTS, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`
  (signing tokens never leak via Referer), `Permissions-Policy`, `Cache-Control: no-store`.
- **Input:** zod validation, control/bidi-character stripping, length limits, PNG signature validation (magic bytes, size,
  dimensions); React escapes all output and email HTML is escaped.
- **Logs:** structured logs contain event codes and opaque ids only: no names, emails, IPs, tokens or document text.
- **Rate limits:** login (per IP and global) and signing submissions, stored in the database so they hold across serverless instances.
- **Owner password:** set `OWNER_PASSWORD_HASH` to a bcrypt hash only; use a long passphrase.
- Signature images, PDFs and audit data live in your database. Back it up, and treat the database as sensitive.

## Legal limits — please read

This app produces a **simple (basic) electronic signature**: consent, intent to sign, an association between the signer and
the record (a unique link sent to their email), and an audit trail. Such signatures are generally valid for many commercial
contracts under India's Information Technology Act, 2000 (s.10A) and the US ESIGN Act / UETA, **but**:

- It is **not** an Aadhaar eSign, a Digital Signature Certificate (DSC) signature, or an eIDAS qualified electronic signature.
  There is no identity verification beyond control of the email address (and the link).
- Some documents cannot be validly signed this way at all, e.g. in India: wills, trusts, powers of attorney, negotiable
  instruments (other than cheques), and contracts for the sale of immovable property, and some documents require stamp duty
  or registration. Other jurisdictions have similar exclusions.
- The PDF is **not** cryptographically signed; integrity rests on the stored SHA-256 hashes and the audit trail.
- The PDF uses standard Latin fonts: characters outside that set (e.g. Devanagari) show as `?` in the PDF, although the
  original text and its hash are kept in the database and signing page. Embed a Unicode font before using non-Latin agreements.
- This is not legal advice. Have a lawyer review your templates and your use case.

For Aadhaar eSign or qualified signatures, integrate a licensed provider (e.g. Digio or Leegality) — see the roadmap.

## Roadmap (not built)

Upload-your-own-PDF with drag-placed signature fields · reminders · templates marketplace · Aadhaar eSign via a licensed ASP.
