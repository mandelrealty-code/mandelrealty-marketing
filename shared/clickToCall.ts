/**
 * CRM click-to-call: pre-call SMS → dial operator → bridge to lead → record.
 */
import { getActiveCallerPhone } from "./crmSettings.js";
import {
  isNonClientCompanyPhone,
  isTwilioConfigured,
  isTwilioSenderPhone,
  toE164,
} from "./followUpSequences.js";
import { getLeadById, updateLeadCrm } from "./leadStore.js";
import {
  createLeadCall,
  getLatestLeadCallForLead,
  getLeadCallById,
  isActiveCallStatus,
  listRecentLeadCalls,
  updateLeadCall,
} from "./leadCalls.js";
import { listSmsForLead, logSmsMessage } from "./smsStore.js";
import { sendTwilioSms } from "./twilioSms.js";
import {
  createTwilioCall,
  twilioWebhookBaseUrl,
  twimlResponse,
  updateTwilioCall,
  xmlEscape,
} from "./twilioVoice.js";

export type TwilioVoiceEnv = {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
};

function firstName(full: string): string {
  const part = full.trim().split(/\s+/)[0];
  return part || "there";
}

export function buildPreCallSms(leadName: string): string {
  const name = firstName(leadName);
  return `Hey ${name}, it's Mandel Realty Group, calling you in a minute from this number. Feel free to pick up. This call may be recorded for quality assurance.`;
}

export function isPreCallSmsBody(body: string): boolean {
  return /calling you in a minute from this number/i.test(body);
}

export async function leadAlreadyGotPreCallSms(leadId: string): Promise<boolean> {
  const msgs = await listSmsForLead(leadId);
  return msgs.some(
    (m) =>
      m.direction === "outbound" &&
      (m.meta?.pre_call === true || isPreCallSmsBody(m.body)),
  );
}

export async function startClickToCall(input: {
  leadId: string;
  operatorPhone?: string;
  env: TwilioVoiceEnv;
}): Promise<{
  ok: boolean;
  callId?: string;
  callSid?: string;
  preCallSmsSent?: boolean;
  preCallSmsSkipped?: boolean;
  error?: string;
}> {
  if (!isTwilioConfigured(input.env)) {
    return { ok: false, error: "Twilio is not configured." };
  }

  const lead = await getLeadById(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found." };

  const leadPhone = toE164(lead.phone || "");
  if (!leadPhone) return { ok: false, error: "Lead has no valid phone number." };
  if (isNonClientCompanyPhone(leadPhone)) {
    return {
      ok: false,
      error:
        "Lead phone is set to a Mandel Realty company number. Enter the client's number, then try again.",
    };
  }

  const operatorPhone = toE164(
    (input.operatorPhone || (await getActiveCallerPhone()) || "").trim(),
  );
  if (!operatorPhone) {
    return {
      ok: false,
      error: "Set your callback phone in Settings (CRM calls) first.",
    };
  }
  // Callback may be the public MRG business line (647…) — that was the working setup.
  // Only block the Twilio sender itself (can't ring the SMS number as the operator).
  if (isTwilioSenderPhone(operatorPhone)) {
    return {
      ok: false,
      error:
        "Callback phone cannot be the Twilio SMS/voice number. Use the MRG business line or your cell.",
    };
  }

  if (operatorPhone === leadPhone) {
    return { ok: false, error: "Operator phone cannot be the same as the lead." };
  }

  // Guard double-clicks: one call start per lead every 20s
  const latest = await getLatestLeadCallForLead(lead.id);
  if (latest) {
    const ageMs = Date.now() - new Date(latest.created_at).getTime();
    if (
      ageMs < 20_000 &&
      !["failed", "canceled", "completed", "summarized", "transcript_ready"].includes(
        latest.status,
      )
    ) {
      return {
        ok: false,
        error: "Call already starting — wait a moment before clicking again.",
      };
    }
  }

  const from = input.env.TWILIO_PHONE_NUMBER!.trim();
  const accountSid = input.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = input.env.TWILIO_AUTH_TOKEN!.trim();

  const alreadyTexted = await leadAlreadyGotPreCallSms(lead.id);

  const callRow = await createLeadCall({
    leadId: lead.id,
    operatorPhone,
    leadPhone,
  });
  if (!callRow) {
    return {
      ok: false,
      error: "Could not create call record. Run supabase/crm_calls_v1.sql?",
    };
  }

  // Concurrent click race: another row won the insert race — abort without SMS/dial
  const recent = await listRecentLeadCalls(lead.id, 3);
  const olderSibling = recent.find((r) => r.id !== callRow.id);
  if (olderSibling) {
    const siblingAge = Date.now() - new Date(olderSibling.created_at).getTime();
    if (
      siblingAge < 20_000 &&
      !["failed", "canceled"].includes(olderSibling.status)
    ) {
      await updateLeadCall(callRow.id, {
        status: "failed",
        error: "duplicate_click",
      });
      return {
        ok: false,
        error: "Call already starting — wait a moment before clicking again.",
      };
    }
  }

  // Pause AI so it doesn't text mid-call
  await updateLeadCrm(lead.id, { aiPaused: true }).catch(() => undefined);

  let preCallSmsSent = false;
  let preCallSmsSkipped = alreadyTexted;

  if (!alreadyTexted) {
    const smsBody = buildPreCallSms(lead.name);
    const sms = await sendTwilioSms({
      accountSid,
      authToken,
      from,
      to: leadPhone,
      body: smsBody,
    });
    if (sms.ok) {
      preCallSmsSent = true;
      await logSmsMessage({
        leadId: lead.id,
        direction: "outbound",
        fromPhone: from,
        toPhone: leadPhone,
        body: smsBody,
        providerSid: sms.sid ?? null,
        meta: { human: true, pre_call: true, call_id: callRow.id },
      }).catch(() => undefined);
    } else {
      console.warn("[clickToCall] pre-call SMS failed", sms.error);
    }
  }

  const base = twilioWebhookBaseUrl();
  const bridgeUrl = `${base}/api/twilio/voice?op=bridge&callId=${encodeURIComponent(callRow.id)}`;
  const statusUrl = `${base}/api/twilio/voice?op=status&callId=${encodeURIComponent(callRow.id)}`;

  const call = await createTwilioCall({
    accountSid,
    authToken,
    to: operatorPhone,
    from,
    url: bridgeUrl,
    statusCallback: statusUrl,
  });

  if (!call.ok || !call.sid) {
    await updateLeadCall(callRow.id, {
      status: "failed",
      error: call.error || "Could not start call",
    });
    return { ok: false, error: call.error || "Could not start call" };
  }

  await updateLeadCall(callRow.id, {
    call_sid: call.sid,
    status: "ringing_operator",
  });
  // Optional until supabase/crm_conference_v1.sql is run — call still works without the column.
  await updateLeadCall(callRow.id, {
    conference_name: conferenceNameForCall(callRow.id),
  }).catch(() => undefined);

  const stamp = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
  const prev = (lead.whats_next || "").trim();
  const smsNote = preCallSmsSent
    ? "Pre-call SMS sent."
    : preCallSmsSkipped
      ? "Pre-call SMS skipped (already sent)."
      : "Pre-call SMS failed.";
  const line = `[Call ${stamp}] Click-to-call started — AI paused. ${smsNote}`;
  await updateLeadCrm(lead.id, {
    whatsNext: prev ? `${line}\n${prev}`.slice(0, 900) : line,
  }).catch(() => undefined);

  return {
    ok: true,
    callId: callRow.id,
    callSid: call.sid,
    preCallSmsSent,
    preCallSmsSkipped,
  };
}

/** Conference room name for a CRM call (warm transfer / multi-party). */
export function conferenceNameForCall(callId: string): string {
  return `mrg-${callId}`;
}

/**
 * TwiML when the booker answers — join the named conference (recorded) and dial the lead in.
 * Conference must sit inside <Dial> (Twilio requirement).
 */
export async function buildOperatorBridgeTwiml(callId: string): Promise<string> {
  const row = await getLeadCallById(callId);
  const from = process.env.TWILIO_PHONE_NUMBER?.trim() || "";
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  if (!row || !from) {
    return twimlResponse(
      `<Say voice="Polly.Joanna">Sorry, this call could not be connected.</Say><Hangup/>`,
    );
  }

  const confName = row.conference_name || conferenceNameForCall(callId);
  await updateLeadCall(callId, {
    status: "bridging",
    conference_name: confName,
    // Booker answered the outbound leg and is joining the conference now.
    booker_joined_at: row.booker_joined_at || new Date().toISOString(),
  });

  const base = twilioWebhookBaseUrl();
  const recordingCb = `${base}/api/twilio/voice?op=recording&callId=${encodeURIComponent(callId)}`;
  const leadJoinUrl = `${base}/api/twilio/voice?op=lead_join&callId=${encodeURIComponent(callId)}`;
  const leadStatus = `${base}/api/twilio/voice?op=status&callId=${encodeURIComponent(callId)}&leg=lead`;

  // Dial the lead into the same conference once (guard against Twilio bridge retries).
  if (accountSid && authToken && !row.dial_call_sid) {
    const leadCall = await createTwilioCall({
      accountSid,
      authToken,
      to: row.lead_phone,
      from,
      url: leadJoinUrl,
      statusCallback: leadStatus,
    });
    if (leadCall.ok && leadCall.sid) {
      await updateLeadCall(callId, { dial_call_sid: leadCall.sid });
    } else {
      console.warn("[clickToCall] lead dial failed", leadCall.error);
    }
  }

  const waitUrl = "http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical";
  return twimlResponse(
    [
      `<Say voice="Polly.Joanna">This call is being recorded.</Say>`,
      `<Dial>`,
      `<Conference beep="false" record="record-from-start" recordingStatusCallback="${xmlEscape(recordingCb)}" recordingStatusCallbackEvent="completed" waitUrl="${xmlEscape(waitUrl)}" waitMethod="GET" startConferenceOnEnter="true" endConferenceOnExit="false">${xmlEscape(confName)}</Conference>`,
      `</Dial>`,
    ].join(""),
  );
}

/** Lead answers — disclosure, then join the same conference. */
export function buildLeadConferenceJoinTwiml(callId: string): string {
  const name = conferenceNameForCall(callId);
  return twimlResponse(
    [
      `<Say voice="Polly.Joanna">This call is being recorded.</Say>`,
      `<Dial>`,
      `<Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">${xmlEscape(name)}</Conference>`,
      `</Dial>`,
    ].join(""),
  );
}

/** Legacy notice endpoint — same disclosure as lead join (kept for old webhook URLs). */
export function buildLeadRecordingNoticeTwiml(): string {
  return twimlResponse(
    `<Say voice="Polly.Joanna">This call is being recorded for quality assurance. Connecting you now.</Say>`,
  );
}

/** Hang up this leg only (booker Leave call). */
export function buildHangupTwiml(): string {
  return twimlResponse(`<Hangup/>`);
}

export async function handleVoiceStatus(input: {
  callId: string;
  callStatus: string;
  callSid?: string;
  leg?: string;
}): Promise<void> {
  const status = input.callStatus.toLowerCase();
  const patch: Parameters<typeof updateLeadCall>[1] = {};
  if (input.callSid && input.leg !== "lead") {
    patch.call_sid = input.callSid;
  }
  if (input.leg === "lead" && input.callSid) {
    patch.dial_call_sid = input.callSid;
  }

  if (status === "completed" || status === "busy" || status === "no-answer" || status === "failed" || status === "canceled") {
    if (input.leg === "lead") {
      patch.status = status === "completed" ? "lead_leg_done" : `lead_${status}`;
    } else {
      patch.status = status === "completed" ? "completed" : status;
    }
  } else if (status === "in-progress" || status === "answered") {
    patch.status = input.leg === "lead" ? "in_call" : "operator_answered";
  }

  // Booker joined the conference: CallSid matches the original outbound booker leg.
  if (
    input.leg !== "lead" &&
    (status === "in-progress" || status === "answered") &&
    input.callSid
  ) {
    const row = await getLeadCallById(input.callId);
    if (row && !row.booker_joined_at) {
      const bookerSid = (row.call_sid || "").trim();
      if (!bookerSid || bookerSid === input.callSid) {
        patch.booker_joined_at = new Date().toISOString();
      }
    }
  }

  if (Object.keys(patch).length) {
    await updateLeadCall(input.callId, patch);
  }
}

export async function handleRecordingReady(input: {
  callId: string;
  recordingSid: string;
  recordingUrl: string;
  env: TwilioVoiceEnv;
}): Promise<void> {
  const mp3Url = input.recordingUrl.endsWith(".mp3")
    ? input.recordingUrl
    : `${input.recordingUrl}.mp3`;

  await updateLeadCall(input.callId, {
    recording_sid: input.recordingSid,
    recording_url: mp3Url,
    status: "recording_ready",
  });

  const row = await getLeadCallById(input.callId);
  if (!row) return;

  if (!isTwilioConfigured(input.env)) {
    await appendCallNoteToLead(row.lead_id, {
      callNotes: null,
      nextSteps: null,
      transcript: null,
      recordingUrl: mp3Url,
      error: "Twilio not configured — recording saved without transcript.",
    });
    return;
  }

  await updateLeadCall(input.callId, { status: "transcribing" });

  const { summarizeCallTranscript, transcribeTwilioRecording } = await import(
    "./callNotesAi.js"
  );

  const tx = await transcribeTwilioRecording({
    recordingUrl: mp3Url,
    accountSid: input.env.TWILIO_ACCOUNT_SID!.trim(),
    authToken: input.env.TWILIO_AUTH_TOKEN!.trim(),
  });

  if (tx.ok === false) {
    const txError = tx.error;
    await updateLeadCall(input.callId, {
      status: "recording_ready",
      error: txError,
    });
    await appendCallNoteToLead(row.lead_id, {
      callNotes: null,
      nextSteps: null,
      transcript: null,
      recordingUrl: mp3Url,
      error: txError,
    });
    return;
  }

  const transcript = tx.text.trim();
  await updateLeadCall(input.callId, {
    transcript,
    status: "summarizing",
  });

  const lead = await getLeadById(row.lead_id);
  const summary = await summarizeCallTranscript({
    leadName: lead?.name || "Lead",
    transcript,
  });

  const summaryText = summary
    ? `${summary.callNotes}\n\nNext steps:\n${summary.nextSteps}`
    : null;

  await updateLeadCall(input.callId, {
    summary: summaryText,
    status: summary ? "summarized" : "transcript_ready",
    error: summary ? null : "Summary failed — transcript saved",
    meta: {
      ...(row.meta || {}),
      ...(summary?.callType ? { call_type: summary.callType } : {}),
      ...(summary?.leadScore ? { lead_score: summary.leadScore } : {}),
      ...(summary?.transferToRyan != null
        ? { transfer_to_ryan: summary.transferToRyan }
        : {}),
      ...(summary?.bookedTime ? { booked_time: summary.bookedTime } : {}),
    },
  });

  await appendCallNoteToLead(row.lead_id, {
    callNotes: summary?.callNotes ?? null,
    nextSteps: summary?.nextSteps ?? null,
    mappedStatus: summary?.mappedStatus ?? null,
    transcript,
    recordingUrl: mp3Url,
    error: summary ? null : "Summary failed — transcript saved",
  });
}

/** Legacy Twilio transcription webhook (unused — Dial recordings use Whisper). */
export async function handleTranscriptionReady(input: {
  callId: string;
  transcriptionSid: string;
  transcriptionStatus: string;
  transcriptionText: string;
}): Promise<void> {
  const row = await getLeadCallById(input.callId);
  if (!row) return;

  const status = input.transcriptionStatus.toLowerCase();
  if (status !== "completed") {
    await updateLeadCall(input.callId, {
      transcription_sid: input.transcriptionSid,
      status: `transcription_${status}`,
      error: status === "failed" ? "Transcription failed" : null,
    });
    return;
  }

  const transcript = (input.transcriptionText || "").trim();
  await updateLeadCall(input.callId, {
    transcription_sid: input.transcriptionSid,
    transcript,
    status: "summarizing",
  });

  const { summarizeCallTranscript } = await import("./callNotesAi.js");
  const lead = await getLeadById(row.lead_id);
  const summary = await summarizeCallTranscript({
    leadName: lead?.name || "Lead",
    transcript,
  });

  const summaryText = summary
    ? `${summary.callNotes}\n\nNext steps:\n${summary.nextSteps}`
    : null;

  await updateLeadCall(input.callId, {
    summary: summaryText,
    status: summary ? "summarized" : "transcript_ready",
    error: summary ? null : "Summary failed — transcript saved",
    meta: {
      ...(row.meta || {}),
      ...(summary?.callType ? { call_type: summary.callType } : {}),
      ...(summary?.leadScore ? { lead_score: summary.leadScore } : {}),
      ...(summary?.transferToRyan != null
        ? { transfer_to_ryan: summary.transferToRyan }
        : {}),
      ...(summary?.bookedTime ? { booked_time: summary.bookedTime } : {}),
    },
  });

  await appendCallNoteToLead(row.lead_id, {
    callNotes: summary?.callNotes ?? null,
    nextSteps: summary?.nextSteps ?? null,
    mappedStatus: summary?.mappedStatus ?? null,
    transcript,
    recordingUrl: row.recording_url,
    error: null,
  });
}

async function appendCallNoteToLead(
  leadId: string,
  input: {
    callNotes: string | null;
    nextSteps: string | null;
    mappedStatus?: import("./crmTypes.js").LeadStatus | null;
    transcript: string | null;
    recordingUrl: string | null;
    error: string | null;
  },
): Promise<void> {
  const lead = await getLeadById(leadId);
  if (!lead) return;

  const stamp = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
  const parts: string[] = [`[Call ${stamp}]`];
  if (input.callNotes) parts.push(input.callNotes);
  else if (input.transcript) {
    parts.push(`Transcript:\n${input.transcript.slice(0, 2500)}`);
  } else if (input.recordingUrl) {
    parts.push(`Recording saved: ${input.recordingUrl}`);
  }
  if (input.error) parts.push(`Note: ${input.error}`);

  const block = parts.join("\n").slice(0, 3500);
  const prevCallNotes = (lead.call_notes || "").trim();
  const nextSteps =
    (input.nextSteps || "").trim() ||
    (input.error
      ? `Review call recording / fix: ${input.error.slice(0, 200)}`
      : "Review call and set next team action.");

  const locked =
    lead.status === "won" || lead.status === "skip" || lead.status === "low_fit";
  const statusPatch = locked
    ? {}
    : input.mappedStatus
      ? { status: input.mappedStatus }
      : { status: "call_done" as const };

  await updateLeadCrm(leadId, {
    callNotes: prevCallNotes ? `${block}\n\n${prevCallNotes}`.slice(0, 8000) : block,
    whatsNext: nextSteps.slice(0, 900),
    aiPaused: false,
    ...statusPatch,
  });

  const { scheduleAiSilenceNudges, AI_NUDGE_POST_CALL_DELAYS_MIN } = await import(
    "./aiSilenceFollowups.js"
  );
  await scheduleAiSilenceNudges(leadId, {
    delaysMin: AI_NUDGE_POST_CALL_DELAYS_MIN,
    allowIfInbound: true,
  }).catch((err) => console.error("[clickToCall] post-call follow-up schedule failed", err));
}

/** TwiML: join the CRM call conference (Ryan transfer leg). */
export function buildConferenceJoinTwiml(callId: string): string {
  const name = conferenceNameForCall(callId);
  return twimlResponse(
    [
      `<Dial>`,
      `<Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false">${xmlEscape(name)}</Conference>`,
      `</Dial>`,
    ].join(""),
  );
}

function transferPhone(): string {
  return (
    process.env.CRM_TRANSFER_PHONE?.trim() ||
    process.env.RYAN_CALLBACK_PHONE?.trim() ||
    ""
  );
}

/**
 * Add Ryan to the existing conference. Does NOT redirect or end booker/lead legs.
 */
export async function transferCrmCall(input: {
  leadId: string;
  env: TwilioVoiceEnv;
}): Promise<{ ok: boolean; error?: string; callId?: string; status?: string }> {
  if (!isTwilioConfigured(input.env)) {
    return { ok: false, error: "Twilio is not configured." };
  }
  const ryan = toE164(transferPhone());
  if (!ryan) {
    return {
      ok: false,
      error: "Set CRM_TRANSFER_PHONE (Ryan’s cell) in the server env to enable transfer.",
    };
  }

  const row = await getLatestLeadCallForLead(input.leadId);
  if (!row || !isActiveCallStatus(row.status)) {
    return { ok: false, error: "No active CRM call to transfer." };
  }

  const confName = row.conference_name || conferenceNameForCall(row.id);
  const accountSid = input.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = input.env.TWILIO_AUTH_TOKEN!.trim();
  const from = input.env.TWILIO_PHONE_NUMBER!.trim();
  const base = twilioWebhookBaseUrl();
  const confUrl = `${base}/api/twilio/voice?op=conference&callId=${encodeURIComponent(row.id)}`;
  const transferStatusUrl = `${base}/api/twilio/voice?op=transfer_status&callId=${encodeURIComponent(row.id)}`;

  await updateLeadCall(row.id, {
    status: "transferring",
    transfer_status: "connecting",
    conference_name: confName,
    error: null,
  });

  const ryanCall = await createTwilioCall({
    accountSid,
    authToken,
    to: ryan,
    from,
    url: confUrl,
    statusCallback: transferStatusUrl,
    statusCallbackEvent: "answered completed",
  });
  if (!ryanCall.ok || !ryanCall.sid) {
    await updateLeadCall(row.id, {
      status: "in_call",
      transfer_status: null,
      transfer_call_sid: null,
      error: ryanCall.error || "Could not dial Ryan",
      meta: { ...(row.meta || {}), transfer_error: ryanCall.error || "dial_failed" },
    });
    return { ok: false, error: ryanCall.error || "Could not dial Ryan." };
  }

  await updateLeadCall(row.id, {
    status: "transferring",
    transfer_status: "connecting",
    transfer_call_sid: ryanCall.sid,
    error: null,
    meta: {
      ...(row.meta || {}),
      transfer_to: ryan,
      transfer_call_sid: ryanCall.sid,
    },
  });

  return { ok: true, callId: row.id, status: "connecting" };
}

/** Ryan outbound call status — answered → transfer_status connected. */
export async function handleTransferStatus(input: {
  callId: string;
  callStatus: string;
  callSid?: string;
}): Promise<void> {
  const status = input.callStatus.toLowerCase();
  const patch: Parameters<typeof updateLeadCall>[1] = {};
  if (input.callSid) patch.transfer_call_sid = input.callSid;

  if (status === "answered" || status === "in-progress") {
    patch.transfer_status = "connected";
    patch.status = "transfer_connected";
    patch.error = null;
  } else if (
    status === "busy" ||
    status === "no-answer" ||
    status === "failed" ||
    status === "canceled"
  ) {
    patch.transfer_status = null;
    patch.status = "in_call";
    patch.error = `Ryan ${status}`;
  } else if (status === "completed") {
    const row = await getLeadCallById(input.callId);
    if (row && String(row.transfer_status || "").toLowerCase() === "connecting") {
      patch.transfer_status = null;
      patch.status = "in_call";
      patch.error = "Ryan did not connect";
    }
  }

  if (Object.keys(patch).length) {
    await updateLeadCall(input.callId, patch);
  }
}

/** Cancel Ryan’s outbound leg only — booker + lead stay in conference. */
export async function cancelCrmTransfer(input: {
  leadId: string;
  env: TwilioVoiceEnv;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isTwilioConfigured(input.env)) {
    return { ok: false, error: "Twilio is not configured." };
  }
  const row = await getLatestLeadCallForLead(input.leadId);
  if (!row) return { ok: false, error: "No active CRM call." };

  const transferSid =
    (row.transfer_call_sid || "").trim() ||
    String(row.meta?.transfer_call_sid || "").trim();
  if (transferSid) {
    await updateTwilioCall({
      accountSid: input.env.TWILIO_ACCOUNT_SID!.trim(),
      authToken: input.env.TWILIO_AUTH_TOKEN!.trim(),
      callSid: transferSid,
      status: "completed",
    }).catch(() => undefined);
  }

  const nextMeta = { ...(row.meta || {}) };
  delete nextMeta.transfer_call_sid;
  await updateLeadCall(row.id, {
    status: isActiveCallStatus(row.status) ? "in_call" : row.status,
    transfer_status: null,
    transfer_call_sid: null,
    meta: nextMeta,
  });
  return { ok: true };
}

/** Booker leaves — hang up their leg only; conference continues for lead (+ Ryan). */
export async function leaveCrmCall(input: {
  leadId: string;
  env: TwilioVoiceEnv;
}): Promise<{ ok: boolean; error?: string; booker_call_seconds?: number }> {
  if (!isTwilioConfigured(input.env)) {
    return { ok: false, error: "Twilio is not configured." };
  }
  const row = await getLatestLeadCallForLead(input.leadId);
  if (!row || !isActiveCallStatus(row.status)) {
    return { ok: false, error: "No active CRM call." };
  }
  if (!row.call_sid) {
    return { ok: false, error: "Booker call leg not found." };
  }

  const base = twilioWebhookBaseUrl();
  const hangupUrl = `${base}/api/twilio/voice?op=hangup`;
  const moved = await updateTwilioCall({
    accountSid: input.env.TWILIO_ACCOUNT_SID!.trim(),
    authToken: input.env.TWILIO_AUTH_TOKEN!.trim(),
    callSid: row.call_sid,
    url: hangupUrl,
  });
  if (!moved.ok) {
    return { ok: false, error: moved.error || "Could not leave call." };
  }

  const leftAt = new Date();
  const joinedMs = row.booker_joined_at
    ? new Date(row.booker_joined_at).getTime()
    : new Date(row.created_at).getTime();
  const seconds = Number.isFinite(joinedMs)
    ? Math.max(0, Math.round((leftAt.getTime() - joinedMs) / 1000))
    : 0;

  await updateLeadCall(row.id, {
    booker_left_at: leftAt.toISOString(),
    booker_joined_at: row.booker_joined_at || new Date(joinedMs).toISOString(),
    booker_call_seconds: seconds,
    meta: { ...(row.meta || {}), operator_left: true },
  });
  return { ok: true, booker_call_seconds: seconds };
}

/** End the whole conference — hang up every known participant leg. */
export async function endCrmCall(input: {
  leadId: string;
  env: TwilioVoiceEnv;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isTwilioConfigured(input.env)) {
    return { ok: false, error: "Twilio is not configured." };
  }
  const row = await getLatestLeadCallForLead(input.leadId);
  if (!row || !isActiveCallStatus(row.status)) {
    return { ok: false, error: "No active CRM call to end." };
  }

  const accountSid = input.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = input.env.TWILIO_AUTH_TOKEN!.trim();
  const sids = [
    row.call_sid,
    row.dial_call_sid,
    (row.transfer_call_sid || "").trim() ||
      String(row.meta?.transfer_call_sid || "").trim() ||
      null,
  ].filter(Boolean) as string[];

  for (const callSid of sids) {
    await updateTwilioCall({
      accountSid,
      authToken,
      callSid,
      status: "completed",
    }).catch(() => undefined);
  }

  await updateLeadCall(row.id, {
    status: "completed",
    transfer_status: null,
  });
  await updateLeadCrm(row.lead_id, { aiPaused: false }).catch(() => undefined);
  return { ok: true };
}
