# Mandel Realty Group — Marketing Site

Premium landing page for **mandelrealtygroup.com**. Converts Google Ads traffic into free 15-minute revenue audit bookings.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- Framer Motion

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to Vercel (recommended)

1. Push this folder to a GitHub repo (e.g. `mandelrealty-marketing`).
2. Import the repo in [Vercel](https://vercel.com) → New Project.
3. Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
4. Add custom domains: `mandelrealtygroup.com` and `www.mandelrealtygroup.com`.

## GoDaddy DNS (point domain to Vercel)

In GoDaddy → DNS for `mandelrealtygroup.com`:

| Type | Name | Value |
|------|------|--------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

(Use the exact records Vercel shows after you add the domain — they may update.)

Remove any old Lovable DNS records that conflict. SSL provisions automatically on Vercel.

## Google Ads deep links

These anchors are live on the page:

- `#proof` — verified earnings table
- `#pricing` — Essential vs Full Service
- `#audit` — lead capture form

## Form submissions (audit leads)

Submissions email **info@mandelrealtygroup.com** via [Resend](https://resend.com).

### Production (Vercel) — required

1. Get your **Resend API key** from [resend.com/api-keys](https://resend.com/api-keys)  
   (You may already have one in Supabase project secrets — same key works.)
2. Vercel → `mandelrealty-marketing` → **Settings** → **Environment Variables**
3. Add `RESEND_API_KEY` = your Resend key (all environments: Production, Preview, Development)
4. **Redeploy** (Deployments → ⋯ → Redeploy)

Optional: `RESEND_FROM` = `Mandel Realty Group <info@mandelrealtygroup.com>` after verifying `mandelrealtygroup.com` in Resend. Until then, emails send from `onboarding@resend.dev`.

**Important for customer confirmation emails:** Resend’s test sender (`onboarding@resend.dev`) can usually only deliver to your own verified Resend account email. To send confirmation emails to form submitters, verify your domain in Resend and set `RESEND_FROM` to an address on that domain (e.g. `Mandel Realty Group <info@mandelrealtygroup.com>`).

### Local testing

```bash
cp .env.example .env.local
# Edit .env.local — set RESEND_API_KEY
npm run dev
```

The dev server now handles `POST /api/audit` so the form works on localhost without Vercel.

### Alternative: Supabase edge function

A `send-audit-lead` function lives in `property-cleaner-hub/supabase/functions/` and reuses `RESEND_API_KEY` from Supabase secrets. Deploy with:

```bash
cd ../property-cleaner-hub
supabase functions deploy send-audit-lead --no-verify-jwt
```

Then set `VITE_AUDIT_API_URL` on Vercel to  
`https://hyndmdjvjlsbthlqrxge.supabase.co/functions/v1/send-audit-lead`

## Screenshots

Replace placeholder slots in the Proof section with real Airbnb dashboard screenshots (drop images in `public/proof/` and update `ProofSection.tsx`).
