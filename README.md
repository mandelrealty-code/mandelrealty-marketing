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

## Form backend

The audit form currently **stubs** submit (success UI + console log). Wire to:

- Formspree / Resend / Supabase edge function — when ready, update `src/components/AuditSection.tsx`.

## Screenshots

Replace placeholder slots in the Proof section with real Airbnb dashboard screenshots (drop images in `public/proof/` and update `ProofSection.tsx`).
