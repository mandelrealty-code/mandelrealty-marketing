import { addDays, torontoToday } from "./time.js";
import type { CopilotDraft } from "./types.js";

export function skillDraft(text: string): CopilotDraft {
  const cleaned = text.replace(/^create a skill that\s+/i, "").trim();
  const when = text.match(/\bwhen\b.+/i)?.[0]?.replace(/\.$/, "") ?? "Overnight, when this comes up.";
  const name = (cleaned || "New skill").slice(0, 64);
  return {
    subject: name,
    body: text.trim(),
    to: "",
    status: "waiting",
    channel: "skill",
    skillName: name,
    skillWhen: when.charAt(0).toUpperCase() + when.slice(1),
    skillReads: "The connected accounts that already have this.",
    skillDrafts: text.trim(),
    skillMustNot: "Send, assign, change a price, or message anyone. It leaves a draft until you approve it.",
    skillKind: "playbook",
  };
}

function isCleanText(text: string) {
  return /\bclean/.test(text.toLowerCase());
}

export function isTextSkillRequest(text: string) {
  return /\b(text|texts|texting|sms)\b/i.test(text);
}

function textSkillDraft(text: string): CopilotDraft {
  const clean = isCleanText(text);
  const cleaned = text.replace(/^create a skill that\s+/i, "").replace(/^create a skill\s+/i, "").trim();
  if (clean) {
    return {
      subject: "Clean done text",
      body: text.trim(),
      to: "",
      status: "waiting",
      channel: "skill",
      skillName: "Clean done text",
      skillWhen: "When the cleaner app says a clean is done.",
      skillReads: "The unit, whether there were issues, and the report link.",
      skillDrafts: "Clean done for {unit} — {no issues, or how many issues}. Here's the link to the report.",
      skillMustNot: "Text a guest, a host, or a client. Invent an issue. Invent a link.",
      skillKind: "text",
      skillPhone: "",
    };
  }
  const name = (cleaned || "Text skill").slice(0, 64);
  return {
    subject: name,
    body: text.trim(),
    to: "",
    status: "waiting",
    channel: "skill",
    skillName: name,
    skillWhen: "When the event you described happens.",
    skillReads: "Only the facts that event already includes.",
    skillDrafts: cleaned || text.trim(),
    skillMustNot: "Text a guest, a host, or a client. Invent an issue. Invent a link.",
    skillKind: "text",
    skillPhone: "",
  };
}

export function skillReply(text: string): { body: string; draft: CopilotDraft } {
  if (isTextSkillRequest(text)) {
    return {
      body: isCleanText(text)
        ? "Here is the text it will send you when a clean is done."
        : "Here is the text it will send you. It texts your number only.",
      draft: textSkillDraft(text),
    };
  }
  return {
    body: "Here is the skill. It runs overnight and leaves a draft for you in the morning.",
    draft: skillDraft(text),
  };
}

export type ReplyResult = {
  body: string;
  draft: CopilotDraft | null;
  reminder: { text: string; dueOn: string } | null;
  memory: string | null;
};

function draft(subject: string, body: string, to = ""): CopilotDraft {
  return { subject, body, to, status: "waiting", channel: "email" };
}

function note(subject: string, body: string): CopilotDraft {
  return { subject, body, to: "", status: "waiting", channel: "note" };
}

function arrivalNote(text: string): string {
  const place = (
    text.match(/\bat\s+(.+?)\.\s+Confirm the arrival details/i)?.[1]
    || text.match(/\b(?:at|for)\s+(.+?)$/i)?.[1]
  )?.replace(/\.$/, "").trim();
  const when = /\btomorrow\b/i.test(text) ? "tomorrow" : /\btoday\b/i.test(text) ? "today" : "";
  const where = place || "the unit on this card";
  const line = when ? `Guest check-in ${when} at ${where}.` : `Guest check-in at ${where}.`;
  return [
    line,
    "",
    "Still to confirm before they arrive:",
    "- Check-in time",
    "- Door code or lock instructions",
    "- Parking",
    "- Wi-Fi",
    "",
    "Those details are not on this card, so I left them blank. I have not messaged the guest.",
  ].join("\n");
}

function planAnswer(text: string): string | null {
  const q = text.toLowerCase();
  if (/essentials|\$199|\$349|message & book|message & optimize/.test(q)) {
    return "Managed Essentials is a flat fee. Message & Book is $199 a month. Message & Optimize is $349. HST is on top. It does not include cleaning, maintenance, or repairs. Furniture is not part of this plan unless you agree that separately. I can draft that explanation. I will not send it until you confirm.";
  }
  if (/growth partnership|aligned growth|confidence partner|benchmark/.test(q)) {
    return "Growth is only for a live listing that already has booking history. Aligned Growth is 10% up to that month's benchmark and 35% above it. Confidence Partner is 5% and 45%. Furniture is not offered on Growth. I will not invent a custom rate. I can draft the note when you want it sent.";
  }
  if (/furniture/.test(q)) {
    return "The furniture plan pairs only with Standard 20% or Full Service 25%. It is not available on Growth or Essentials. After 24 months the furniture transfers. I can start a sourcing list when you attach the floor plan, measurements, and photos. I can't place an item into the photo until that step is ready, and I won't pretend a composite is real if it looks wrong.";
  }
  return null;
}

export function replyTo(text: string, previousDraft: CopilotDraft | null, now = new Date()): ReplyResult {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const today = torontoToday(now);

  if (/^create a skill\b/i.test(trimmed) || /\bcreate a skill that\b/i.test(lower)) {
    const skill = skillReply(trimmed);
    return { body: skill.body, draft: skill.draft, reminder: null, memory: null };
  }

  if (/^remind me\b/.test(lower) || /\bremind me tomorrow\b/.test(lower)) {
    const about = trimmed.replace(/^remind me( tomorrow)?( to)?/i, "").trim() || trimmed;
    return {
      body: `I'll remind you tomorrow about ${about}. I have not contacted anyone.`,
      draft: null,
      reminder: { text: about, dueOn: addDays(today, 1) },
      memory: `Reminder set: ${about}`,
    };
  }

  if (previousDraft && /increase|change|update|9 month|clause/.test(lower)) {
    const nextBody = `${previousDraft.body}\n\nUpdate from you: ${trimmed}`;
    const next = previousDraft.channel === "note"
      ? note(previousDraft.subject, nextBody)
      : draft(previousDraft.subject, nextBody, previousDraft.to);
    return {
      body: "Updated. The draft now includes what you just said. It is still waiting. Nothing has been sent.",
      draft: next,
      reminder: null,
      memory: trimmed.slice(0, 240),
    };
  }

  const plan = planAnswer(trimmed);
  if (plan && !/draft|send|email|write/.test(lower)) {
    return { body: plan, draft: null, reminder: null, memory: null };
  }

  if (/attached:/.test(lower) && /\.(png|jpe?g|webp|pdf|heic)/.test(lower)) {
    return {
      body: "I have the file name. I can't read the picture yet, because Cursor isn't connected to look at it. Tell me what you want drafted from it, or attach the measurements in the message. I won't invent a layout.",
      draft: null,
      reminder: null,
      memory: null,
    };
  }

  if (/floor plan|measurements|source|sourcing/.test(lower)) {
    return {
      body: "Attach the floor plan, the measurements, and the photos of the unit. I'll look for real items that fit and draft a sourcing PDF. I won't send it to the client. If I can't find a size that fits, I'll say so.",
      draft: null,
      reminder: null,
      memory: null,
    };
  }

  if (/whatsapp/.test(lower)) {
    return {
      body: "WhatsApp is not linked yet. I can't read host groups, and I won't send a WhatsApp message until you confirm one.",
      draft: null,
      reminder: null,
      memory: null,
    };
  }

  if (/\barrival note\b/.test(lower)) {
    return draftForCard(trimmed, "Draft the arrival note");
  }

  if (/^(hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening)\b[.!]?$/i.test(trimmed)) {
    return {
      body: "Hello. Ask me to draft a message, write an arrival note, or set a reminder. I won't send anything until you confirm.",
      draft: null,
      reminder: null,
      memory: null,
    };
  }

  if (/pricelabs|price lab/.test(lower)) {
    return {
      body: "I can draft a price note. I can't change PriceLabs from here. You would apply the rate yourself after you approve the note.",
      draft: note("Price note", `Suggested change:\n${trimmed}\n\nI can't change PriceLabs from here.`),
      reminder: null,
      memory: null,
    };
  }

  if (/don't know|do not know|can you|how do i/.test(lower) && trimmed.length < 40) {
    return {
      body: "I don't know that yet. I can draft a message, set a reminder, or look up a contract that is waiting for a signature. Tell me which of those you want.",
      draft: null,
      reminder: null,
      memory: null,
    };
  }

  if (/\b(draft|write|email)\b/.test(lower) && /\b(email|message|note)\b/.test(lower)) {
    const subject = /contract|agreement|sign/.test(lower) ? "Following up on your agreement" : "Following up";
    return {
      body: "Here is a draft. It is waiting for you. Nothing has been sent.",
      draft: draft(subject, trimmed, ""),
      reminder: null,
      memory: null,
    };
  }

  return {
    body: "I don't have a draft for that. Ask me to draft a message, write an arrival note, set a reminder, or create a skill. I won't invent one.",
    draft: null,
    reminder: null,
    memory: null,
  };
}

export function draftForCard(text: string, action: string): ReplyResult {
  const label = action.toLowerCase();
  if (label.includes("arrival")) {
    return {
      body: "Here is the arrival note. It is for you. Nothing has been sent to the guest.",
      draft: note("Arrival note", arrivalNote(text)),
      reminder: null,
      memory: null,
    };
  }
  if (label.includes("message")) {
    const who = text.match(/^(.+?) hasn't signed/i)?.[1]?.trim() ?? "";
    const signed = text.match(/hasn't signed (.+?)\./i)?.[1]?.trim() || "";
    const what = signed ? signed.charAt(0).toUpperCase() + signed.slice(1) : "The agreement";
    const greeting = who && who !== "A client" ? `Hi ${who},` : "Hi,";
    return {
      body: "Here is the email. It is waiting for you. Nothing has been sent.",
      draft: draft(
        "Following up on your agreement",
        `${greeting}\n\n${what} is still waiting for a signature. I have not sent this.\n\nMandel Realty Group`,
        "",
      ),
      reminder: null,
      memory: null,
    };
  }
  if (label.includes("next step")) {
    const title = text.replace(/\s+is due today\.?$/i, "").trim() || text;
    const step = /clean/i.test(text)
      ? "Confirm the cleaner is assigned and the unit will be ready today."
      : /maint|repair|fix/i.test(text)
        ? "Confirm who is doing the repair and that it can be finished today."
        : "Confirm who is doing this and that it will be finished today.";
    return {
      body: "Here is the next step. I have not assigned anyone, and nothing has been sent.",
      draft: note("Next step", `${title} is due today.\n\nNext step: ${step}\n\nI have not assigned anyone.`),
      reminder: null,
      memory: null,
    };
  }
  if (label.includes("follow")) {
    const about = text.replace(/^You asked me to remind you:\s*/i, "").trim() || text;
    return {
      body: "Here is the follow-up you asked for. I have not contacted anyone.",
      draft: note("Follow-up", `${about}\n\nThis is the reminder you saved. I have not contacted anyone.`),
      reminder: null,
      memory: null,
    };
  }
  return {
    body: "Here is a note from that card. It is not an email, and nothing has been sent.",
    draft: note(action || "Note", text),
    reminder: null,
    memory: null,
  };
}
