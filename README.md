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

Submissions email **info@mandelrealtygroup.com** via [Resend](https://resend.com) (same provider as the Stravo app).

### One-time Vercel setup

1. Get your **Resend API key** from [resend.com/api-keys](https://resend.com/api-keys)  
   (You may already have one in Supabase — you can reuse the same key.)
2. In **Vercel** → your `mandelrealty-marketing` project → **Settings** → **Environment Variables**
3. Add:
   - `RESEND_API_KEY` = your Resend key
   - (Optional) `RESEND_FROM` = `Mandel Realty Group <info@mandelrealtygroup.com>` after you verify `mandelrealtygroup.com` in Resend. Until then, emails send from `onboarding@resend.dev` but still **deliver to info@mandelrealtygroup.com**.
4. **Redeploy** the project (Deployments → ⋯ → Redeploy)

Test the form on the live site — you should receive an email at info@mandelrealtygroup.com within a minute.

## Screenshots

Replace placeholder slots in the Proof section with real Airbnb dashboard screenshots (drop images in `public/proof/` and update `ProofSection.tsx`).
