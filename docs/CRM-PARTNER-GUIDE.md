# Mandel Realty CRM — Partner Guide

**Who this is for:** You and your business partner  
**What this is:** An in-house CRM + AI closer that texts leads, routes them down the right offer path, and shows you exactly where every conversation stands — without living in HubSpot.

---

## Bottom line

This is a **professional AI closer** that:

1. Reads each imported lead (Meta paste, website form, etc.)
2. Knows what to sell based on where they came from and what they told us
3. Texts them via Twilio using our knowledge base (contracts, permits, guides, talk tracks)
4. Moves them through stages (or stops) like a real closer would
5. Gives us full visibility — and lets either of us jump into any chat instantly

You are never locked out. AI can be paused on **one chat** or turned off for **the whole CRM**.

---

## How to open it

- Go to **admin.mandelrealtygroup.com**
- Sign in with the admin password
- Use it on your phone — bottom tabs are built for that

### The four tabs

| Tab | What it’s for |
|-----|----------------|
| **Contacts** | Search and open people. Tap a name → full SMS inbox. |
| **Pipeline** | Same leads laid out by stage (Kanban-style columns). |
| **Knowledge** | Upload PDFs/DOCX/TXT the AI is allowed to learn from (contracts, guides, permit notes). |
| **Settings** | Paste Meta leads + master **AI Responses (all chats)** switch. |

---

## Daily workflow (what you’ll actually do)

### 1. Import a Meta lead
1. Open **Settings**
2. Paste the whole lead from Meta Leads Center
3. Hit **Preview**, then **Import to CRM**

The AI reads their answers (listing yes/no, city, permit status, readiness, etc.) and — if AI is on — sends the first text.

### 2. Watch the conversation
1. Open **Contacts** → tap their name
2. You see: offer path, journey status, SMS thread, notes, what’s next
3. Stages are big pills at the top — one tap to move them (e.g. Booked)

### 3. Jump in anytime (one chat only)
On the contact screen:

- **Take over** (or flip the toggle) → AI stops on **that chat only**
- Send your own SMS → also pauses AI on that chat
- **Resume AI** when you want it back

Settings → **AI Responses (all chats)** is the global kill switch for every lead. Use that when you want silence CRM-wide. Use Take over when you only need one conversation.

---

## How to “read” a lead at a glance

### Journey symbols (left of each contact)

| Symbol | Meaning |
|--------|---------|
| **●** (green, pulsing) | AI is actively texting this lead |
| **◌** (amber) | **Nurturing** — education path; follow up later (AI paused by design) |
| **✓** (blue) | **Booked** — call booked; AI stopped |
| **‖** | AI paused / off on this chat (or CRM AI is off) |
| **★** | Call done / Won |
| **–** | Low fit / Skip (dead end) |

### Offer path (what we’re selling them)

| Path | Who it’s for | What the AI does |
|------|----------------|------------------|
| **Full-service management** | Has listing, or owns/buying a property | Personalizes around listing/city/permits → pushes a free intro call |
| **Airbnb makeover** | Came from makeover-style ads | Sells the makeover + books a call |
| **Learn / guides** | No property / just curious | Sends free Intro to Airbnb guide → nurtures → later can offer paid guide |
| **Offer TBD** | Not clear yet | AI clarifies, then routes |

### Pipeline stages

| Stage | Meaning |
|-------|---------|
| **New** | Just imported |
| **Engaging** | Active SMS conversation |
| **Nurturing** | Education path — waiting on follow-up |
| **Interested** | Wants a call / ready for the offer |
| **Booked** | Call on the calendar — AI stopped |
| **Call done** | Call happened |
| **Won** | Closed |
| **Low fit** | Not a fit (e.g. STR not allowed) |
| **Skip** | Opted out / dead |

**What’s next** on the contact is the AI’s internal note: where it routed them and what should happen next. That’s your “Shane – has listing – permit question – awaiting call” style status in plain language.

---

## How the AI closer actually works

### Lead comes in
Import (or website form) saves:

- Name, phone, email, city
- Has Airbnb listing?
- Where they are in the process (own ready / buying / researching)
- STR / permit answers
- Source (e.g. Meta Instant Form)

From that, we assign an **offer path** and start the right conversation.

### AI responds from the knowledge base
It does **not** invent contracts, prices, or city permit law. It answers from docs you upload in **Knowledge** (PDF, DOCX, TXT, MD).

**Example — has listing, unsure about permit (Brampton):**  
AI looks up permit info from the knowledge base, references their apartment/city, and pitches management:  
*“Hey Shane — thanks for your interest in our management services. I see you have a place in Brampton but aren’t sure about the permit — you do need one there, and that’s something we specialize in. Want to hop on a quick call?”*

**Example — no property, just curious:**  
AI sends the free Intro to Airbnb guide (URL must be in the knowledge base), moves them to **Nurturing**, and **stops auto-replying**. Later you (or a scheduled follow-up) check progress and can offer a paid advanced guide — so cold leads still make money over time.

### Status updates as they move
- Book a call → stage **Booked**, AI pauses, symbol becomes **✓**
- Education guide delivered → **Nurturing**, AI stops until follow-up
- Not interested / dead end → **Low fit** or **Skip**, AI stops

### The AI knows when to stop
It backs off when:

- They booked / confirmed a call
- Free guide was delivered and they’re in nurture
- They say stop / not interested
- Clearly not a fit
- Conversation is looping with no progress

It is **not** a blast machine. It’s a closer that disengages on purpose.

---

## What you need to feed it (knowledge base)

The AI is only as good as what you upload under **Knowledge**. Activate docs so they count; deactivate drafts.

Upload things like:

- Management / co-hosting talk tracks
- Free Airbnb makeover pitch
- City permit notes (e.g. Brampton)
- Free Intro to Airbnb guide + download link
- Paid advanced guide + link / price
- Contract summaries you’re OK quoting
- Booking rules and the book-a-call link context

**Rule of thumb:** If it isn’t in Knowledge, the AI should say “we’ll confirm on a call” — not make it up.

---

## Controls cheat sheet

| Control | Scope | Where |
|---------|--------|--------|
| **AI Responses toggle** | Entire CRM | Settings |
| **Take over / Resume AI** | One lead only | Contact → banner under stages |
| **Send SMS yourself** | Pauses AI on that lead | Contact composer |
| **Stage pills** | Manual override anytime | Contact header |
| **Mark booked** | Stage = Booked + AI off for that lead | Contact actions |
| **Knowledge upload / activate** | What AI can say | Knowledge tab |

---

## What this buys us vs doing it by hand

| Before | Now |
|--------|-----|
| Paste lead → hope someone texts | Paste lead → AI opens with the right pitch |
| Same script for everyone | Path-aware: management vs makeover vs education |
| No idea who’s mid-conversation | Symbols + stages + What’s next |
| Fear of AI going rogue forever | Stops on book / nurture / dead end; Take over anytime |
| Cold “just curious” leads die | Free guide → nurture → paid guide later |
| Knowledge trapped in our heads | Upload once → AI uses it on every chat |

---

## What gets better over time

1. Upload better knowledge (permits by city, winning SMS lines, guide links)
2. Watch which paths convert (management vs makeover vs education)
3. Tighten talk tracks in Knowledge — AI pitches improve without rebuilding the CRM
4. Later: timed nurture follow-ups (e.g. “did you read the guide?” + paid offer ~30 days)

---

## One-sentence summary for anyone new

**Paste Meta leads → AI texts the right pitch from our knowledge base → we see path + stage at a glance → AI stops when they book or go cold → either of us can Take over any single chat without killing AI for everyone.**
