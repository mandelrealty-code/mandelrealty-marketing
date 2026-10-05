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

function phoneIn(text: string) {
  return text.match(/(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/)?.[0]?.trim() ?? "";
}

export function skillReply(text: string): { body: string; draft: CopilotDraft } {
  if (isTextSkillRequest(text)) {
    const draft = textSkillDraft(text);
    const lower = text.toLowerCase();
    if (isCleanText(text)) {
      if (/unit name only/.test(lower)) draft.skillDrafts = "Clean done for {unit}.";
      else if (/failed inspection/.test(lower)) {
        draft.skillDrafts = "Clean done for {unit} — {no issues, or how many issues}. Say if the unit failed inspection.";
      } else if (/whether there were issues/.test(lower) && !/report link/.test(lower)) {
        draft.skillDrafts = "Clean done for {unit} — {no issues, or how many issues}.";
      }
    }
    const phone = phoneIn(text);
    if (phone) draft.skillPhone = phone;
    return {
      body: isCleanText(text)
        ? "Here is the text it will send you when a clean is done."
        : "Here is the text it will send you. It texts your number only.",
      draft,
    };
  }
  return {
    body: "Here is the skill. Saving it does not send anything. The next run only prepares a draft.",
    draft: skillDraft(text),
  };
}

function ask(body: string, choices?: string[]): ReplyResult {
  return { body, draft: null, choices: choices ?? null, reminder: null, memory: null };
}

export function skillTurn(
  text: string,
  prior: { role: string; body: string }[],
): ReplyResult {
  const assistants = prior.filter((message) => message.role === "assistant").map((message) => message.body);
  const said = [...prior.filter((message) => message.role === "user").map((message) => message.body), text].join("\n");
  const lower = said.toLowerCase();
  const askedInclude = assistants.some((body) => body.startsWith("What should the text include?"));
  const askedWho = assistants.some((body) => body.startsWith("Who should get this text?"));
  const askedNumber = assistants.some((body) => body.includes("What number should it text"));
  const askedPrepare = assistants.some((body) => /what should I prepare|what should it do, and who is it for/i.test(body));
  const askedNever = assistants.some((body) => body.startsWith("What should it never do?"));
  const texting = /\b(text|texts|texting|sms)\b/.test(lower);
  const clean = texting && /\bclean/.test(lower);
  const described = /unit name only|whether there were issues|report link|failed inspection/.test(lower);
  const hasPhone = Boolean(phoneIn(said));

  if (clean && !askedInclude && !described) {
    return ask("What should the text include?", [
      "Unit name only",
      "Unit, and whether there were issues",
      "Unit, issues, and the report link if the cleaner app sent one",
    ]);
  }
  if (clean && !askedWho && !askedNumber && !hasPhone && (askedInclude || described)) {
    return ask("Who should get this text?", ["My mobile only", "My mobile and my partner's"]);
  }
  if (texting && !askedNumber && !hasPhone && (askedWho || askedInclude || described)) {
    return ask(
      /partner/.test(lower)
        ? "This skill texts one number. What number should it text? It will not text a guest."
        : "What number should it text?",
    );
  }
  if (!texting && !askedPrepare && assistants.length === 0) {
    if (/owner lead/.test(lower)) {
      return ask("When a new owner lead comes in, what should I prepare, and who is it for?");
    }
    return ask("What should it do, and who is it for?");
  }
  if (!texting && askedPrepare && !askedNever && !/\b(never|must not|don't|do not)\b/.test(lower)) {
    return ask("What should it never do?");
  }
  const built = skillReply(said);
  return {
    body: built.body,
    draft: built.draft,
    choices: null,
    reminder: null,
    memory: `Skill discussed: ${built.draft.skillName ?? "New skill"}`,
  };
}

export type ReplyResult = {
  body: string;
  draft: CopilotDraft | null;
  choices?: string[] | null;
  reminder: { text: string; dueOn: string } | null;
  memory: string | null;
};

export type ReplyContext = {
  lastAssistant?: string;
  stayPlace?: string | null;
  stayWhen?: string | null;
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

export function replyTo(
  text: string,
  previousDraft: CopilotDraft | null,
  now = new Date(),
  ctx: ReplyContext = {},
): ReplyResult {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const today = torontoToday(now);
  const last = ctx.lastAssistant ?? "";
  const place = trimmed.match(/\b(?:for|at) the (.+?) check-?in/i)?.[1]?.trim() || ctx.stayPlace || "";
  const when = ctx.stayWhen || (/\btomorrow\b/i.test(trimmed) ? "tomorrow" : /\btoday\b/i.test(trimmed) ? "today" : "");

  if (/^create a skill\b/i.test(trimmed) || /\bcreate a skill that\b/i.test(lower)) {
    return skillTurn(trimmed, []);
  }

  if (/Want me to write the arrival note\?|Do you mean the .+ check-in/.test(last) && /^(yes|yeah|yep|please|do it|write it)\b/i.test(trimmed) && place) {
    return draftForCard(
      `A guest checks in ${when || "tomorrow"} at ${place}. Confirm the arrival details before they arrive.`,
      "Draft the arrival note",
    );
  }

  if (last.startsWith("Who is this for?")) {
    if (/client|hasn.?t signed|unsigned/.test(lower)) {
      return {
        body: "Here is the email. Gmail is not connected, so it stays a draft. Nothing has been sent.",
        draft: draft(
          "Following up on your agreement",
          "Hi,\n\nThe agreement is still waiting for a signature. I have not sent this.\n\nMandel Realty Group",
        ),
        choices: null,
        reminder: null,
        memory: null,
      };
    }
    if (/reminder|\bus\b/.test(lower)) {
      return {
        body: "Here is the reminder. I have not contacted anyone.",
        draft: note("Reminder", "The agreement is still unsigned.\n\nThis is for you. I have not contacted the client."),
        choices: null,
        reminder: null,
        memory: null,
      };
    }
  }

  if (last.startsWith("What should I prepare?")) {
    if (/arrival note/.test(lower)) {
      return place
        ? draftForCard(
            `A guest checks in ${when || "tomorrow"} at ${place}. Confirm the arrival details before they arrive.`,
            "Draft the arrival note",
          )
        : ask("Which check-in is this for?");
    }
    if (/guest/.test(lower)) {
      return {
        body: "Gmail is not connected, so this stays a draft. Who is it to?",
        choices: ["The guest on this stay", "The host"],
        draft: null,
        reminder: null,
        memory: null,
      };
    }
    if (/cleaner/.test(lower)) {
      return {
        body: "Here is the note for the cleaner. I have not assigned anyone, and nothing has been sent.",
        draft: note("Cleaner note", place
          ? `Check-in ${when || "tomorrow"} at ${place}.\n\nConfirm the clean is set before they arrive. I have not assigned anyone.`
          : "Confirm the clean is set before the guest arrives. I have not assigned anyone."),
        choices: null,
        reminder: null,
        memory: null,
      };
    }
  }

  if (/\bplan\b/.test(lower) && /check-?in/.test(lower)) {
    return ask("What should I prepare?", ["An arrival note for us", "A message to the guest", "A note for the cleaner"]);
  }

  if (/\b(write|draft)\b/.test(lower) && /unsigned agreement/.test(lower)) {
    return ask("Who is this for?", ["The client who hasn't signed", "Us, as a reminder"]);
  }

  if (/check-?in/.test(lower) && /\b(handle|can you)\b/.test(lower)) {
    return ask(place ? `Do you mean the ${place} check-in ${when || "tomorrow"}?` : "Which check-in do you mean?");
  }

  if (/get ahead of tomorrow/.test(lower)) {
    return ask(place
      ? `The ${place} guest checks in ${when || "tomorrow"}. Want me to write the arrival note?`
      : "What should I get ahead of?");
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
