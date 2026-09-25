/** OPS Reviews reply jobs — draft, approve, post via Hospitable. */

import { getSupabaseAdmin } from "../../supabase.js";
import { getHospitablePat } from "../clientStore.js";
import {
  getPropertyKnowledgeHub,
  listReservationMessages,
  respondToHospitableReview,
} from "../hospitableClient.js";
import { listPmProperties } from "../propertyStore.js";
import { syncHospitableReviews } from "../reviewStore.js";
import { sendTwilioSms } from "../../twilioSms.js";
import { draftReviewReply, type ReviewDecision } from "./agent.js";

function db() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  return sb;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

export type ReplyJobStatus = "pending" | "posted" | "held";

export type ReviewReplyJob = {
  id: string;
  review_id: string;
  hospitable_review_id: string;
  property_id: string;
  listing_nickname: string;
  guest_first_name: string;
  stars: number | null;
  platform: string;
  class: string;
  status: ReplyJobStatus;
  decision_json: ReviewDecision | Record<string, unknown>;
  draft_reply: string;
  edited_reply: string;
  posted_reply: string;
  posted_by: string;
  posted_at: string | null;
  removal_packet_json: ReviewDecision["removal_packet"] | null;
  removal_filed: boolean;
  removal_filed_at: string | null;
  removal_outcome: string;
  draft_before_edit: string;
  confidence: string;
  needs_human: boolean;
  reason_for_escalation: string;
  sign_off: boolean;
  notified_at: string | null;
  dry_run: boolean;
  created_at: string;
  updated_at: string;
  /** Joined from review */
  public_review?: string;
  check_in?: string | null;
  check_out?: string | null;
  reviewed_at?: string | null;
  hospitable_reservation_id?: string;
};

const SIGN_OFF = "\n\n— The MRG team";

function dryRunDefault(): boolean {
  const v = process.env.REVIEW_REPLY_DRY_RUN?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

function mapJob(row: Record<string, unknown>): ReviewReplyJob {
  return {
    id: String(row.id),
    review_id: String(row.review_id),
    hospitable_review_id: String(row.hospitable_review_id || ""),
    property_id: String(row.property_id),
    listing_nickname: String(row.listing_nickname || ""),
    guest_first_name: String(row.guest_first_name || ""),
    stars: row.stars == null || row.stars === "" ? null : Number(row.stars),
    platform: String(row.platform || "airbnb"),
    class: String(row.class || "A"),
    status: (String(row.status || "pending") as ReplyJobStatus) || "pending",
    decision_json: (row.decision_json as ReviewDecision) || {},
    draft_reply: String(row.draft_reply || ""),
    edited_reply: String(row.edited_reply || ""),
    posted_reply: String(row.posted_reply || ""),
    posted_by: String(row.posted_by || ""),
    posted_at: (row.posted_at as string) || null,
    removal_packet_json:
      (row.removal_packet_json as ReviewDecision["removal_packet"]) || null,
    removal_filed: Boolean(row.removal_filed),
    removal_filed_at: (row.removal_filed_at as string) || null,
    removal_outcome: String(row.removal_outcome || ""),
    draft_before_edit: String(row.draft_before_edit || ""),
    confidence: String(row.confidence || "high"),
    needs_human: row.needs_human !== false,
    reason_for_escalation: String(row.reason_for_escalation || ""),
    sign_off: row.sign_off !== false,
    notified_at: (row.notified_at as string) || null,
    dry_run: row.dry_run !== false,
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    public_review: row.public_review != null ? String(row.public_review) : undefined,
    check_in: (row.check_in as string) || null,
    check_out: (row.check_out as string) || null,
    reviewed_at: (row.reviewed_at as string) || null,
    hospitable_reservation_id:
      row.hospitable_reservation_id != null
        ? String(row.hospitable_reservation_id)
        : undefined,
  };
}

function effectiveReply(job: ReviewReplyJob, override?: string): string {
  let body = (override ?? (job.edited_reply || job.draft_reply || "")).trim();
  if (job.sign_off && body && !/— The MRG team\s*$/.test(body)) {
    body = `${body}${SIGN_OFF}`;
  }
  return body.slice(0, 1000);
}

export async function listReviewReplyJobs(input?: {
  status?: ReplyJobStatus | "removal" | "all";
}): Promise<ReviewReplyJob[]> {
  const status = input?.status || "pending";
  let q = db()
    .from("pm_review_reply_jobs")
    .select(
      "*, pm_reviews(public_review, check_in, check_out, reviewed_at, hospitable_reservation_id)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status === "removal") {
    q = q.not("removal_packet_json", "is", null);
  } else if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) {
    if (/pm_review_reply_jobs|relation|column/i.test(error.message || "")) {
      throw new Error(
        "Review reply jobs table missing. Run supabase/pm_review_replies_v1.sql in Supabase.",
      );
    }
    throw error;
  }

  return (data || []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const rev = (row.pm_reviews || {}) as Record<string, unknown>;
    delete row.pm_reviews;
    return mapJob({
      ...row,
      public_review: rev.public_review,
      check_in: rev.check_in,
      check_out: rev.check_out,
      reviewed_at: rev.reviewed_at,
      hospitable_reservation_id: rev.hospitable_reservation_id,
    });
  });
}

export async function getReviewReplyJob(id: string): Promise<ReviewReplyJob | null> {
  const { data, error } = await db()
    .from("pm_review_reply_jobs")
    .select(
      "*, pm_reviews(public_review, check_in, check_out, reviewed_at, hospitable_reservation_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const rev = (row.pm_reviews || {}) as Record<string, unknown>;
  delete row.pm_reviews;
  return mapJob({
    ...row,
    public_review: rev.public_review,
    check_in: rev.check_in,
    check_out: rev.check_out,
    reviewed_at: rev.reviewed_at,
    hospitable_reservation_id: rev.hospitable_reservation_id,
  });
}

async function notifyRyan(job: ReviewReplyJob): Promise<void> {
  const to =
    process.env.REVIEW_REPLY_NOTIFY_PHONE?.trim() ||
    process.env.RYAN_PHONE?.trim() ||
    "";
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (!to || !sid || !token || !from) return;

  const base =
    process.env.ADMIN_PUBLIC_URL?.trim() ||
    "https://admin.mandelrealtygroup.com";
  const link = `${base.replace(/\/$/, "")}/ops/reviews/${job.id}`;
  const stars = job.stars != null ? `${job.stars}★` : "?★";
  const body = `MRG review ${stars} · ${job.listing_nickname || "Listing"} · ${job.guest_first_name || "Guest"} · Class ${job.class}\n${link}`;

  const result = await sendTwilioSms({
    accountSid: sid,
    authToken: token,
    from,
    to,
    body,
  });
  if (result.ok) {
    await db()
      .from("pm_review_reply_jobs")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", job.id);
  } else {
    console.warn("[reviewReply] SMS failed", result.error);
  }
}

async function summarizeKnowledge(pat: string, hospitablePropertyId: string): Promise<string> {
  try {
    const hub = await getPropertyKnowledgeHub(pat, hospitablePropertyId);
    if (!hub) return "";
    const text = JSON.stringify(hub);
    return text.slice(0, 6000);
  } catch {
    return "";
  }
}

/** Sync reviews then create draft jobs for unanswered Airbnb reviews. */
export async function processUnansweredReviews(input?: {
  propertyId?: string;
  notify?: boolean;
}): Promise<{ synced: number; drafted: number; skipped: number }> {
  const sync = await syncHospitableReviews(
    input?.propertyId ? { propertyId: input.propertyId } : undefined,
  );

  const pat = await getHospitablePat();
  if (!pat) throw new Error("Hospitable is not connected.");

  const props = await listPmProperties();
  const propById = new Map(props.map((p) => [p.id, p]));

  let q = db()
    .from("pm_reviews")
    .select("*")
    .or("public_response.eq.,public_response.is.null")
    .order("reviewed_at", { ascending: false })
    .limit(80);
  if (input?.propertyId) q = q.eq("property_id", input.propertyId);

  const { data, error } = await q;
  if (error) throw error;

  let drafted = 0;
  let skipped = 0;

  for (const raw of data || []) {
    const rev = raw as Record<string, unknown>;
    const hospitableReviewId = str(rev.hospitable_review_id);
    if (!hospitableReviewId) {
      skipped += 1;
      continue;
    }
    const platform = str(rev.platform).toLowerCase();
    if (platform && platform !== "airbnb" && !platform.includes("airbnb")) {
      skipped += 1;
      continue;
    }
    if (str(rev.public_response)) {
      skipped += 1;
      continue;
    }

    const { data: existing } = await db()
      .from("pm_review_reply_jobs")
      .select("id")
      .eq("hospitable_review_id", hospitableReviewId)
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }

    const propertyId = str(rev.property_id);
    const prop = propById.get(propertyId);
    const listing = prop?.name || "Listing";
    const reservationId = str(rev.hospitable_reservation_id);
    const cats = Array.isArray(rev.category_ratings_json)
      ? (rev.category_ratings_json as Array<{ type: string; rating: number }>)
      : [];

    let messages: Array<{ role: string; at: string | null; body: string }> = [];
    if (reservationId) {
      try {
        const msgs = await listReservationMessages(pat, reservationId);
        messages = msgs.map((m) => ({
          role: m.sender_role,
          at: m.created_at,
          body: m.body,
        }));
      } catch {
        /* optional */
      }
    }

    const knowledgeSummary = prop?.hospitable_property_id
      ? await summarizeKnowledge(pat, prop.hospitable_property_id)
      : "";

    const decision = await draftReviewReply({
      reviewId: hospitableReviewId,
      listing,
      guestFirstName: str(rev.guest_first_name),
      stars: rev.rating == null ? null : Number(rev.rating),
      publicReview: str(rev.public_review),
      privateFeedback: str(rev.private_feedback),
      categoryRatings: cats,
      platform: platform || "airbnb",
      messages,
      knowledgeSummary,
    });

    // Class F under 5 with no text — still queue for Ryan to skip/hold
    const { data: inserted, error: insErr } = await db()
      .from("pm_review_reply_jobs")
      .insert({
        review_id: rev.id,
        hospitable_review_id: hospitableReviewId,
        property_id: propertyId,
        listing_nickname: listing,
        guest_first_name: str(rev.guest_first_name),
        stars: rev.rating == null ? null : Number(rev.rating),
        platform: platform || "airbnb",
        class: decision.class,
        status: "pending",
        decision_json: decision,
        draft_reply: decision.draft_reply,
        edited_reply: decision.draft_reply,
        removal_packet_json: decision.removal_packet,
        confidence: decision.confidence,
        needs_human: decision.needs_human,
        reason_for_escalation: decision.reason_for_escalation,
        sign_off: true,
        dry_run: dryRunDefault(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insErr) {
      if (/duplicate|unique/i.test(insErr.message || "")) {
        skipped += 1;
        continue;
      }
      throw insErr;
    }

    drafted += 1;
    const job = mapJob(inserted as Record<string, unknown>);
    if (input?.notify !== false) {
      await notifyRyan(job).catch(() => undefined);
    }
  }

  return { synced: sync.synced, drafted, skipped };
}

export async function updateReviewReplyJob(
  id: string,
  patch: {
    edited_reply?: string;
    sign_off?: boolean;
    status?: ReplyJobStatus;
    removal_filed?: boolean;
    removal_outcome?: string;
  },
): Promise<ReviewReplyJob> {
  const current = await getReviewReplyJob(id);
  if (!current) throw new Error("Review job not found.");

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.edited_reply != null) {
    const next = patch.edited_reply.slice(0, 1000);
    if (!current.draft_before_edit && next !== current.draft_reply) {
      updates.draft_before_edit = current.draft_reply;
    }
    updates.edited_reply = next;
  }
  if (patch.sign_off != null) updates.sign_off = patch.sign_off;
  if (patch.status === "held" || patch.status === "pending") {
    updates.status = patch.status;
  }
  if (patch.removal_filed != null) {
    updates.removal_filed = patch.removal_filed;
    updates.removal_filed_at = patch.removal_filed
      ? new Date().toISOString()
      : null;
  }
  if (patch.removal_outcome != null) {
    updates.removal_outcome = patch.removal_outcome;
  }

  const { data, error } = await db()
    .from("pm_review_reply_jobs")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapJob(data as Record<string, unknown>);
}

export async function approveAndPostReviewReply(input: {
  id: string;
  reply?: string;
  sign_off?: boolean;
  posted_by?: string;
}): Promise<ReviewReplyJob> {
  const job = await getReviewReplyJob(input.id);
  if (!job) throw new Error("Review job not found.");
  if (job.status === "posted") return job;

  if (input.sign_off != null) {
    await updateReviewReplyJob(job.id, { sign_off: input.sign_off });
  }
  if (input.reply != null) {
    await updateReviewReplyJob(job.id, { edited_reply: input.reply });
  }
  const fresh = (await getReviewReplyJob(job.id))!;
  const reply = effectiveReply(fresh, input.reply);
  if (!reply) throw new Error("Reply text is empty.");

  const dry = fresh.dry_run || dryRunDefault();
  if (!dry) {
    const pat = await getHospitablePat();
    if (!pat) throw new Error("Hospitable is not connected.");
    await respondToHospitableReview(pat, fresh.hospitable_review_id, reply);
    await db()
      .from("pm_reviews")
      .update({
        public_response: reply,
        responded_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      })
      .eq("id", fresh.review_id);
  }

  const { data, error } = await db()
    .from("pm_review_reply_jobs")
    .update({
      status: "posted",
      posted_reply: reply,
      edited_reply: reply,
      posted_by: input.posted_by || "ryan",
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dry_run: dry,
    })
    .eq("id", fresh.id)
    .select("*")
    .single();
  if (error) throw error;
  return mapJob(data as Record<string, unknown>);
}
