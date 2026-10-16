# Phase 0: image delivery and reply-latency test (a partner runs this)

Nothing in this test is automated. A partner sends the one message, from Guest messaging, on a
throwaway reservation. Copilot only reads what happens.

## Why

The grocery flow needs to know three things before it is built:

1. Does Hospitable's send tool accept images, and does the guest actually SEE them in the Airbnb thread?
2. How long until a guest's reply (typed in the Airbnb app or website) shows up in Copilot?
3. Do messages a partner types inside the Airbnb app show up in Copilot (the "can't see replies sent inside the Airbnb app" caveat)?

## Step A: free pre-check (no message sent)

Settings, Hospitable. The line under "It can't send messages…" lists the fields Hospitable's send tool takes.
The next deploy also adds "Image attachments: …" to that line. If it says the send tool lists no image field,
stop: skip to the fallback below. Screenshot the line either way.

## Step B: the image test

Use a throwaway reservation: a partner's own booking from a second Airbnb account, or a stay with a guest
account a partner controls. Never a real guest.

1. Guest messaging, open that thread.
2. Write: `Test message for the groceries feature, please ignore.`
3. Attach ONE small JPG (under 1 MB). Use a made-up receipt, with no real address, card or personal details:
   the image is uploaded to the `pm-contracts` storage bucket and sent as a public link.
4. Press Submit. Record each answer in the table:

| Check | Result |
|---|---|
| Copilot says sent (not "pending") | |
| The sent message in Copilot shows the image | |
| Hospitable's inbox shows the message and the image | |
| The host's Airbnb inbox shows the message and the image | |
| **The GUEST account sees the image in the Airbnb thread** | |
| Seconds from Submit to the guest seeing it | |

5. Repeat with three images, and once with a photo taken on an iPhone (HEIC).
6. Repeat once with the text only, to confirm the text arrives with no image problem.

## Step C: reply latency, and the "inside the Airbnb app" question

1. From the guest account, reply `Test reply 1` in the Airbnb app. Leave Copilot open on Guest messaging.
   Record seconds until it appears in Copilot.
2. Close the Guest messaging screen (stay on Overview). Reply `Test reply 2`. Record seconds until the
   sidebar count or the thread shows it.
3. Close Copilot entirely. Reply `Test reply 3`. Record how long until Copilot shows it when reopened,
   and whether the 5 AM / 1 PM checks picked it up.
4. From the guest account, send an image as a reply. Does the thread in Copilot show it?
5. From the HOST side, type a message inside the Airbnb app itself (not through Copilot). Does it show in
   Hospitable? In Copilot? What name does Copilot show for the sender?

## What the code says today (read, not tested)

- Guest messages reach Copilot through Hospitable, which carries the Airbnb thread. That is how every guest
  message in Guest messaging gets there today, so a guest's reply typed in the Airbnb app is read the same way.
- The "I cannot see replies sent inside the Airbnb app" line in `shared/copilot/stayCheck.ts` is attached to
  findings that say "No host reply is in the thread". It is a caution about HOST/partner replies, not guest replies.
  Step C5 tests whether it is still true.
- Copilot learns of a new reply by polling: about every 10 seconds on Guest messaging, 30 seconds on other
  screens, and otherwise at 5 AM and 1 PM. There is no Hospitable webhook. The pg_cron trigger (see
  `pg-cron-trigger.md`) is what closes the gap when nobody has Copilot open.

## Decision after the test

| Result | Then |
|---|---|
| Guest sees the image | Send receipts as images, plus the itemized text. |
| Guest does NOT see the image | Itemized text only in the thread. The receipt image is uploaded on the Resolution Center request by a partner. |
| Guest replies take more than about a minute with Copilot open | Say so: the trigger interval and the approval-queue timing change. |
| Partner messages typed in the Airbnb app do not appear | Copilot can't know a partner already answered. The queue must ask "already handled?" before drafting. |

Report the filled table back.
