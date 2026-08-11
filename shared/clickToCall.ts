/**
 * CRM click-to-call: pre-call SMS → dial operator → bridge to lead → record.
 */
import { getCrmSettings } from "./crmSettings.js";
import { isTwilioConfigured, toE164 } from "./followUpSequences.js";
import { getLeadById, updateLeadCrm } from "./leadStore.js";
import { createLeadCall, getLeadCallById, updateLeadCall } from "./leadCalls.js";
import { logSmsMessage } from "./smsStore.js";
import { sendTwilioSms } from "./twilioSms.js";
import {
  createTwilioCall,
  requestTwilioTranscription,
  twilioWebhookBaseUrl,
  twimlResponse,
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
  return `Hey ${name}, it's Mandel Realty Group — calling you in a minute from this number. Feel free to pick up.`;
}

export async function startClickToCall(input: {
  leadId: string;
  operatorPhone?: string;
  env: TwilioVoiceEnv;
}): Promise<{ ok: boolean; callId?: string; callSid?: string; error?: string }> {
  if (!isTwilioConfigured(input.env)) {
    return { ok: false, error: "Twilio is not configured." };
  }

  const lead = await getLeadById(input.leadId);
  if (!lead) return { ok: false, error: "Lead not found." };

  const leadPhone = toE164(lead.phone || "");
  if (!leadPhone) return { ok: false, error: "Lead has no valid phone number." };

  const settings = await getCrmSettings();
  const operatorPhone = toE164(
    (input.operatorPhone || settings.operator_callback_phone || "").trim(),
  );
  if (!operatorPhone) {
    return {
      ok: false,
      error: "Set your callback phone in Settings (CRM calls) first.",
    };
  }

  if (operatorPhone === leadPhone) {
    return { ok: false, error: "Operator phone cannot be the same as the lead." };
  }

  const from = input.env.TWILIO_PHONE_NUMBER!.trim();
  const accountSid = input.env.TWILIO_ACCOUNT_SID!.trim();
  const authToken = input.env.TWILIO_AUTH_TOKEN!.trim();

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

  // Pause AI so it doesn't text mid-call
  await updateLeadCrm(lead.id, { aiPaused: true }).catch(() => undefined);

  const smsBody = buildPreCallSms(lead.name);
  const sms = await sendTwilioSms({
    accountSid,
    authToken,
    from,
    to: leadPhone,
    body: smsBody,
  });
  if (sms.ok) {
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

  const base = twilioWebhookBaseUrl();
  const bridgeUrl = `${base}/api/twilio/voice-bridge?callId=${encodeURIComponent(callRow.id)}`;
  const statusUrl = `${base}/api/twilio/voice-status?callId=${encodeURIComponent(callRow.id)}`;

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

  const stamp = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
  const prev = (lead.whats_next || "").trim();
  const line = `[Call ${stamp}] Click-to-call started — AI paused. Pre-call SMS ${sms.ok ? "sent" : "failed"}.`;
  await updateLeadCrm(lead.id, {
    whatsNext: prev ? `${line}\n${prev}`.slice(0, 900) : line,
  }).catch(() => undefined);

  return { ok: true, callId: callRow.id, callSid: call.sid };
}

/** TwiML when the operator answers — bridge to the lead and record. */
export async function buildOperatorBridgeTwiml(callId: string): Promise<string> {
  const row = await getLeadCallById(callId);
  const from = process.env.TWILIO_PHONE_NUMBER?.trim() || "";
  if (!row || !from) {
    return twimlResponse(
      `<Say voice="Polly.Joanna">Sorry, this call could not be connected.</Say><Hangup/>`,
    );
  }

  await updateLeadCall(callId, { status: "bridging" });

  const base = twilioWebhookBaseUrl();
  const recordingCb = `${base}/api/twilio/voice-recording?callId=${encodeURIComponent(callId)}`;
  const leadStatus = `${base}/api/twilio/voice-status?callId=${encodeURIComponent(callId)}&leg=lead`;

  return twimlResponse(
    [
      `<Say voice="Polly.Joanna">Connecting you to the lead. This call may be recorded.</Say>`,
      `<Dial callerId="${xmlEscape(from)}" record="record-from-answer-dual" recordingStatusCallback="${xmlEscape(recordingCb)}" recordingStatusCallbackEvent="completed" timeout="45">`,
      `<Number statusCallback="${xmlEscape(leadStatus)}" statusCallbackEvent="initiated ringing answered completed">${xmlEscape(row.lead_phone)}</Number>`,
      `</Dial>`,
    ].join(""),
  );
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

  if (!isTwilioConfigured(input.env)) return;

  const base = twilioWebhookBaseUrl();
  const tx = await requestTwilioTranscription({
    accountSid: input.env.TWILIO_ACCOUNT_SID!.trim(),
    authToken: input.env.TWILIO_AUTH_TOKEN!.trim(),
    recordingSid: input.recordingSid,
    statusCallback: `${base}/api/twilio/voice-transcription?callId=${encodeURIComponent(input.callId)}`,
  });

  if (tx.ok && tx.sid) {
    await updateLeadCall(input.callId, {
      transcription_sid: tx.sid,
      status: "transcribing",
    });
  } else {
    await updateLeadCall(input.callId, {
      status: "recording_ready",
      error: tx.error || "Transcription request failed",
    });
    // Still note the recording on the lead
    const row = await getLeadCallById(input.callId);
    if (row) {
      await appendCallNoteToLead(row.lead_id, {
        summary: null,
        transcript: null,
        recordingUrl: mp3Url,
        error: tx.error || null,
      });
    }
  }
}

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

  await updateLeadCall(input.callId, {
    summary: summary || null,
    status: summary ? "summarized" : "transcript_ready",
    error: summary ? null : "Summary failed — transcript saved",
  });

  await appendCallNoteToLead(row.lead_id, {
    summary,
    transcript,
    recordingUrl: row.recording_url,
    error: null,
  });
}

async function appendCallNoteToLead(
  leadId: string,
  input: {
    summary: string | null;
    transcript: string | null;
    recordingUrl: string | null;
    error: string | null;
  },
): Promise<void> {
  const lead = await getLeadById(leadId);
  if (!lead) return;

  const stamp = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" });
  const parts: string[] = [`[Call notes ${stamp}]`];
  if (input.summary) parts.push(input.summary);
  else if (input.transcript) {
    parts.push(`Transcript:\n${input.transcript.slice(0, 2500)}`);
  } else if (input.recordingUrl) {
    parts.push(`Recording ready (transcription pending): ${input.recordingUrl}`);
  }
  if (input.error) parts.push(`Note: ${input.error}`);

  const block = parts.join("\n").slice(0, 3500);
  const prevNotes = (lead.notes || "").trim();
  const prevNext = (lead.whats_next || "").trim();

  await updateLeadCrm(leadId, {
    notes: prevNotes ? `${block}\n\n${prevNotes}`.slice(0, 8000) : block,
    whatsNext: input.summary
      ? `Call done — ${input.summary.slice(0, 280)}`
      : prevNext.startsWith("[Call ")
        ? `Call recorded ${stamp}`
        : prevNext || `Call recorded ${stamp}`,
    ...(lead.status === "booked" || lead.status === "won" || lead.status === "call_done"
      ? {}
      : { status: "call_done" as const }),
  });
}
