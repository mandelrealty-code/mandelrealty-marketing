Management Meta ads — dated packs
=================================

Each batch of new creatives goes in a dated folder:

  public/ads/management/YYYY-MM-DD/<ad-slug>/

Today's pack (2026-08-05):

  2026-08-05/
    v1-free-furnish/         "We'll furnish your Airbnb. Free."
    v2-stop-self-managing/   "Stop Self-Managing Your Airbnb!"
    v3-making-you-more/      "Your Airbnb Should Be Making You More."
    v4-on-call/              "You Didn't Sign Up To Be On-Call 24/7."

Each ad folder has:
  4x5_1080x1350.png    Feed (primary — upload first)
  1x1_1080x1080.png    Feed square / right column
  9x16_1080x1920.png   Stories & Reels
  copy.txt             Primary text + on-image copy for Ads Manager

Free Furnish ad (the one you asked about):
  public/ads/management/2026-08-05/v1-free-furnish/

Rebuild:
  node public/ads/management/render-meta.mjs
  node public/ads/management/render-meta.mjs v1-free-furnish
  DATE=2026-08-12 node public/ads/management/render-meta.mjs   # force a date folder

Requires: npm install --no-save puppeteer-core  + Google Chrome
