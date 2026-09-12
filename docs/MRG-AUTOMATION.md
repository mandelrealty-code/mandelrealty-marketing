# MRG Automation

**This is the canonical name for the unified ops platform plan.**

If you reopen Cursor and say **“continue MRG Automation”**, that means this plan.

## What it is

Link Admin OPS, Cleaner Hub (`portal.stravo.ai`), Guidebook, and CohostAI on the same **Hospitable property UUID**, make each app usable for MRG, then automate:

1. Turnover QA (cleaner Done → VA task)
2. Supply (low stock → order → restock)
3. Knowledge Hub → Guidebook + Cohost
4. Reviews (5★ drafts / ≤4★ tasks)

**Not in V1:** merging the four Supabase projects, or building a fifth greenfield hub app.

## Status (2026-09-12)

| Track | Status |
|-------|--------|
| Cleaner Hub dogfood (import, photos, schedule windows, invites, cleaner flow) | **In progress** — Sync is Hospitable-only (no iCal dupes); Overview uses turnover windows; Sync refreshes listing details + lookback. Still dogfood one full turnover before marking done. |
| Link every MRG unit across 4 apps | Pending |
| Guidebook V1 | Pending |
| CohostAI V1 (Knowledge Hub) | Pending |
| Admin cockpit deep links | Pending |
| Four automations above | Pending |
| Sellable Stravo shell | Later |

## Where Cursor stores the plan

- Plan file: `~/.cursor/plans/mrg_automation.plan.md` (name: **MRG Automation**)
- Related: Property Hub Identity, Cleaner Hub Simplify, older MRG Ops Automation Plan

## Closing a chat tab

Safe to close. You do **not** lose:

- Git commits / pushes on `property-cleaner-hub` and other repos
- Deployed Supabase edge functions / Vercel builds

You **do** lose only the in-tab agent scratchpad. Resume with this doc or the plan name **MRG Automation**.
