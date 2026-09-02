import {
  LEAD_INBOX,
  buildLeadNotificationHtml,
  buildLeadSubject,
  sendResendEmail,
  type LeadEmailInput,
} from "./auditEmails.js";
import { inferAdAngle } from "./adAngle.js";
import { sendAiFirstSms } from "./aiSmsAgent.js";
import { isTwilioConfigured } from "./followUpSequences.js";
import { findLeadByEmailOrPhone, insertLead, type LeadRow } from "./leadStore.js";
import {
  decideMetaImport,
  parseMetaLeadPaste,
  type ParsedMetaLead,
} from "./parseMetaLeadPaste.js";

export type MetaDuplicateInfo = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  has_listing: string;
};

export type MetaImportPreview = {
  parsed: ParsedMetaLead;
  decision: ReturnType<typeof decideMetaImport>;
  duplicate: MetaDuplicateInfo | null;
};

export type MetaImportResult = MetaImportPreview & {
  leadId: string | null;
  emailSent: boolean;
  inboxNotified: boolean;
  smsScheduled?: boolean;
  smsSentNow?: number;
  aiSkipped?: string;
  error?: string;
};

function toDuplicateInfo(row: LeadRow): MetaDuplicateInfo {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    created_at: row.created_at,
    has_listing: row.has_listing,
  };
}

function toEmailInput(parsed: ParsedMetaLead): LeadEmailInput {
  return {
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    address: parsed.address,
    earnings: parsed.earnings,
    listingTitle: parsed.listingTitle || undefined,
    hasListing: parsed.hasListing,
    callBooking: "",
    callStartIso: "",
    source: "meta_instant_form",
    marketingOptIn: true,
    propertyStage: parsed.propertyStage,
    permitStatus: parsed.permitStatus,
    strAllowed: parsed.strAllowed,
  };
}

export async function previewMetaLeadPaste(
  paste: string,
): Promise<MetaImportPreview | { error: string }> {
  const text = paste.trim();
  if (!text) return { error: "Paste is empty." };
  const parsed = parseMetaLeadPaste(text);
  if (!parsed.email && !parsed.phone && !parsed.name) {
    return { error: "Could not read a lead from that paste." };
  }
  const existing = await findLeadByEmailOrPhone(parsed.email, parsed.phone);
  return {
    parsed,
    decision: decideMetaImport(parsed),
    duplicate: existing ? toDuplicateInfo(existing) : null,
  };
}

export async function importParsedMetaLead(
  parsed: ParsedMetaLead,
  env: {
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  },
  options?: {
    sourceLabel?: string;
    source?: string;
  },
): Promise<MetaImportResult> {
  const decision = decideMetaImport(parsed);
  const preview: MetaImportPreview = {
    parsed,
    decision,
    duplicate: null,
  };

  const existing = await findLeadByEmailOrPhone(parsed.email, parsed.phone);
  if (existing) {
    return {
      ...preview,
      duplicate: toDuplicateInfo(existing),
      leadId: existing.id,
      emailSent: false,
      inboxNotified: false,
      error: `Duplicate lead: ${existing.name} (${existing.email || existing.phone}) is already in the CRM as "${existing.status}". Import skipped.`,
    };
  }

  if (!parsed.name || !parsed.email || !parsed.phone) {
    return {
      ...preview,
      leadId: null,
      emailSent: false,
      inboxNotified: false,
      error: "Need name, email, and phone before importing.",
    };
  }

  const sourceLabel = options?.sourceLabel || "Meta Leads Center paste";
  const source = options?.source || "meta_instant_form";

  const notesLines = [
    `Imported from ${sourceLabel}.`,
    `Ad angle: ${inferAdAngle({ source, rawAnswers: parsed.rawAnswers })}`,
    `Has Airbnb: ${parsed.hasListing}`,
    `Book-a-call email: not sent (SMS only)`,
    `SMS: ${decision.qualifiesForBookEmail ? "AI first message when AI is on" : "none"}`,
    `Offer path: ${decision.offerPath}`,
    ...Object.entries(parsed.rawAnswers).map(([k, v]) => `${k}: ${v}`),
  ];

  const leadId = await insertLead({
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    address: parsed.address || "Not provided",
    earnings: parsed.earnings,
    listingTitle: parsed.listingTitle,
    hasListing: parsed.hasListing,
    callStartIso: "",
    callBooking: "",
    source,
    marketingOptIn: true,
    propertyStage: parsed.propertyStage,
    permitStatus: parsed.permitStatus,
    strAllowed: parsed.strAllowed,
    status: decision.status,
    notes: notesLines.join("\n"),
    offerPath: decision.offerPath,
  });

  if (!leadId) {
    return {
      ...preview,
      leadId: null,
      emailSent: false,
      inboxNotified: false,
      error: "Could not save lead to CRM.",
    };
  }

  const emailInput = toEmailInput(parsed);
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM?.trim() || "Mandel Realty Group <onboarding@resend.dev>";
  let inboxNotified = false;
  const emailSent = false;
  let smsScheduled = false;
  let smsSentNow = 0;
  let aiSkipped: string | undefined;

  if (apiKey) {
    const inbox = await sendResendEmail({
      apiKey,
      from,
      to: [LEAD_INBOX],
      subject: buildLeadSubject(emailInput),
      html: buildLeadNotificationHtml(emailInput),
      replyTo: parsed.email.includes("@meta-lead.local") ? undefined : parsed.email,
    });
    inboxNotified = inbox.ok;
  }

  if (isTwilioConfigured(env) && decision.qualifiesForBookEmail) {
    const sent = await sendAiFirstSms({ leadId, env });
    if (sent.ok) {
      smsScheduled = true;
      smsSentNow = 1;
      if (sent.error) aiSkipped = sent.error;
    } else if (sent.skipped) {
      aiSkipped = sent.reason || sent.error;
    } else {
      aiSkipped = sent.error || "AI SMS failed";
    }
  }

  const { notifyOperatorsNewLead } = await import("./leadNotifySms.js");
  await notifyOperatorsNewLead(
    {
      leadId,
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      city: parsed.address,
      hasListing: parsed.hasListing,
      propertyStage: parsed.propertyStage,
      offerPath: decision.offerPath,
      source,
    },
    env,
  ).catch(() => undefined);

  return {
    ...preview,
    leadId,
    emailSent,
    inboxNotified,
    smsScheduled,
    smsSentNow,
    aiSkipped,
  };
}

export async function importMetaLeadPaste(
  paste: string,
  env: {
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  },
): Promise<MetaImportResult> {
  const preview = await previewMetaLeadPaste(paste);
  if ("error" in preview) {
    return {
      parsed: parseMetaLeadPaste(""),
      decision: decideMetaImport(parseMetaLeadPaste("")),
      duplicate: null,
      leadId: null,
      emailSent: false,
      inboxNotified: false,
      error: preview.error,
    };
  }

  const campaign = campaignFromParsed(preview.parsed);

  return importParsedMetaLead(preview.parsed, env, {
    sourceLabel: campaign
      ? `Meta paste (${campaign})`
      : "Meta Leads Center paste",
    source: campaign ? `meta_paste:${campaign}` : "meta_paste",
  });
}

function campaignFromParsed(parsed: ParsedMetaLead): string {
  return (
    parsed.rawAnswers.campaign_name ||
    parsed.rawAnswers.campaign_or_ad ||
    parsed.rawAnswers.ad_name ||
    parsed.rawAnswers.form_name ||
    ""
  );
}

export async function importMetaLeadWebhook(
  body: Record<string, unknown>,
  env: {
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
  },
): Promise<MetaImportResult> {
  const { parseMetaLeadWebhook } = await import("./parseMetaLeadWebhook.js");
  const parsed = parseMetaLeadWebhook(body);
  if ("error" in parsed) {
    return {
      parsed: parseMetaLeadPaste(""),
      decision: decideMetaImport(parseMetaLeadPaste("")),
      duplicate: null,
      leadId: null,
      emailSent: false,
      inboxNotified: false,
      error: parsed.error,
    };
  }

  const campaign =
    parsed.rawAnswers.campaign_or_ad ||
    parsed.rawAnswers.campaign_name ||
    parsed.rawAnswers.ad_name ||
    "";

  return importParsedMetaLead(parsed, env, {
    sourceLabel: campaign
      ? `Make.com Meta Lead Ads (${campaign})`
      : "Make.com Meta Lead Ads",
    source: campaign ? `meta_make:${campaign}` : "meta_make",
  });
}
