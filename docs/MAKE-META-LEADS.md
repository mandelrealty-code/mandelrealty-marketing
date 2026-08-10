# Make.com → Meta leads → CRM (no Meta App Review)

Auto-import Instant Form leads into the Mandel CRM and let the AI send the first SMS — **without** building a Meta app or going through App Review.

## Flow

```
Meta Instant Form fill
  → Make "Facebook Lead Ads" trigger
  → Make HTTP module POST to our webhook
  → CRM saves lead + AI first text
```

## 1. Add the secret (Vercel)

In Vercel → Project → Environment Variables, set one of:

- `META_LEAD_WEBHOOK_SECRET` = a long random string (preferred), **or**
- reuse `CRON_SECRET` / `BOOKING_WEBHOOK_SECRET`

Redeploy after saving.

## 2. Webhook URL

```
POST https://www.mandelrealtygroup.com/api/webhooks/meta-lead
Authorization: Bearer YOUR_SECRET
Content-Type: application/json
```

## 3. Build the Make scenario (you’re already on New scenario)

### Module 1 — Trigger

1. Click the purple **+**
2. Search **Facebook Lead Ads** (or **Meta Lead Ads**)
3. Choose **Watch Lead Forms** / **New lead** (wording varies)
4. Connect your Facebook Page + the Instant Form(s) that run your ads
5. Save

> If Facebook Lead Ads doesn’t appear yet: search **Facebook** / **Meta**, connect the Page, then pick Lead Ads. Make’s connection handles Meta permissions — you don’t create a developer app.

### Module 2 — HTTP (send to CRM)

1. Add another module → search **HTTP**
2. Choose **Make a request**
3. Settings:

| Field | Value |
|-------|--------|
| URL | `https://www.mandelrealtygroup.com/api/webhooks/meta-lead` |
| Method | `POST` |
| Headers | `Authorization` = `Bearer YOUR_SECRET` |
| Headers | `Content-Type` = `application/json` |
| Body type | Raw / JSON |
| Request content | Map fields from the Facebook module (see below) |

### Recommended JSON body (map from Facebook module)

Easiest: map each Instant Form answer into clear keys:

```json
{
  "full_name": "{{1.full_name}}",
  "email": "{{1.email}}",
  "phone_number": "{{1.phone_number}}",
  "city": "{{1.city}}",
  "has_listing": "{{1.Do you have an Airbnb listing live right now?}}",
  "property_stage": "{{1.Where are you in the process?}}",
  "str_allowed": "{{1.Does your building or area allow Airbnb / short-term rentals?}}",
  "permit_status": "{{1.STR permit status}}",
  "campaign_name": "{{1.campaign_name}}",
  "ad_name": "{{1.ad_name}}",
  "form_name": "{{1.form_name}}"
}
```

Exact Make tokens depend on your form field names — click into the JSON editor and pick fields from the Facebook module panel.

**Also works:** sending Meta’s raw `field_data` array as-is. Our webhook flattens both styles.

### 4. Turn it on

1. Click **Run once** and submit a test lead from Meta (or use Make’s sample)
2. Confirm CRM Contacts shows the lead and AI sent (if AI is on)
3. Toggle the scenario **ON** (scheduling: Facebook trigger is instant; ignore “Every 15 minutes” unless Make forces a poll)

## What the CRM does with each lead

1. Dedupes by email/phone (duplicates return `ok: true` so Make won’t retry-fail)
2. Sets **offer path** (management / makeover / education) from answers + campaign/ad name
3. Saves to Contacts
4. Emails the team inbox (if Resend is configured)
5. AI sends first SMS when global AI is on

## Test without Meta

```bash
curl -X POST "https://www.mandelrealtygroup.com/api/webhooks/meta-lead" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test Lead",
    "email": "test@example.com",
    "phone_number": "+16475551234",
    "city": "Brampton",
    "has_listing": "No - not yet",
    "property_stage": "I own a property and I'\''m ready to start",
    "str_allowed": "Yes",
    "permit_status": "I don'\''t know if I need one",
    "campaign_name": "management_gta"
  }'
```

## Keep paste as backup

Settings → **Paste Meta lead** still works if Make is down.
