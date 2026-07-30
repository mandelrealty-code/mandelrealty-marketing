import {
  LEAD_INBOX,
  buildCustomerConfirmationHtml,
  buildCustomerSubject,
  buildLeadNotificationHtml,
  buildLeadSubject,
  sendResendEmail,
  type LeadEmailInput,
} from "./auditEmails.js";
import { isTwilioConfigured } from "./followUpSequences.js";
import { processDueFollowups, scheduleSmsSequence } from "./followUpStore.js";
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

  const { parsed, decision, duplicate } = preview;
  if (duplicate) {
    return {
      ...preview,
      leadId: duplicate.id,
      emailSent: false,
      inboxNotified: false,
      error: `Duplicate lead: ${duplicate.name} (${duplicate.email || duplicate.phone}) is already in the CRM as "${duplicate.status}". Import skipped.`,
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

  const notesLines = [
    "Imported from Meta Leads Center paste.",
    `Has Airbnb: ${parsed.hasListing}`,
    `Book-a-call email: ${decision.qualifiesForBookEmail ? "sent (qualified)" : "not sent (no live Airbnb)"}`,
    `SMS sequence: ${decision.qualifiesForBookEmail ? "hot_sms" : "nurture_sms"}`,
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
    source: "meta_instant_form",
    marketingOptIn: true,
    propertyStage: parsed.propertyStage,
    permitStatus: parsed.permitStatus,
    strAllowed: parsed.strAllowed,
    status: decision.status,
    notes: notesLines.join("\n"),
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
  let emailSent = false;
  let smsScheduled = false;
  let smsSentNow = 0;

  if (apiKey) {
    const inbox = await sendResendEmail({
      apiKey,
      from,
      to: [LEAD_INBOX],
      subject: buildLeadSubject(emailInput),
      html: buildLeadNotificationHtml(emailInput),
      replyTo: parsed.email,
    });
    inboxNotified = inbox.ok;

    if (decision.qualifiesForBookEmail) {
      const customer = await sendResendEmail({
        apiKey,
        from,
        to: [parsed.email],
        subject: buildCustomerSubject(emailInput),
        html: buildCustomerConfirmationHtml(emailInput),
        replyTo: LEAD_INBOX,
      });
      emailSent = customer.ok;
    }
  }

  if (isTwilioConfigured(env)) {
    const sequence = decision.qualifiesForBookEmail ? "hot_sms" : "nurture_sms";
    const scheduled = await scheduleSmsSequence({
      leadId,
      name: parsed.name,
      sequence,
    });
    smsScheduled = scheduled.ok;
    if (scheduled.ok) {
      const due = await processDueFollowups(env);
      smsSentNow = due.sent;
    }
  }

  return {
    ...preview,
    leadId,
    emailSent,
    inboxNotified,
    smsScheduled,
    smsSentNow,
  };
}
