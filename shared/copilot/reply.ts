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
    const next = draft(
      previousDraft.subject,
      `${previousDraft.body}\n\nUpdate from you: ${trimmed}`,
      previousDraft.to,
    );
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

  if (/whatsapp|family chat/.test(lower)) {
    return {
      body: "WhatsApp is not linked yet. When it is, I will only keep groups that are you, your partner, and a host saved in Admin. Family chats are dropped before they are saved. I can't read them, and I won't send a WhatsApp message until you confirm one.",
      draft: null,
      reminder: null,
      memory: null,
    };
  }

  if (/pricelabs|price lab/.test(lower)) {
    return {
      body: "I can draft a price note. I can't change PriceLabs from here. You would apply the rate yourself after you approve the note.",
      draft: draft("Price note", `Suggested change:\n${trimmed}`, ""),
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

  const subject = /contract/.test(lower) ? "Following up on your agreement" : "Following up";
  return {
    body: "Here is a draft. It is waiting for you. Nothing has been sent.",
    draft: draft(subject, trimmed, ""),
    reminder: null,
    memory: null,
  };
}

export function draftForCard(text: string, action: string): ReplyResult {
  return {
    body: `${text} ${action} is ready below. Nothing has been sent.`,
    draft: draft(action, text, ""),
    reminder: null,
    memory: null,
  };
}
