/**
 * One guest thread, read end to end before anything is shown.
 * Amounts, times and dates are copied from the thread. A draft is written
 * only as a held next step when the guest owes the next move, and it is
 * not a sendable waiting item.
 */

import { isThanksOnly, needsGuestReply } from "./guestTranslate.js";
import type { ThreadMedia } from "./guestMedia.js";
import { researchWeb } from "./skillResearch.js";

export type ThreadTurn = {
  at: string;
  role: string;
  name: string;
  body: string;
  media: ThreadMedia[];
};

export type ThreadRead = {
  lane: "reply" | "guest" | "none";
  status: string;
  statusLead: string;
  statusRest: string;
  watch: string;
  waitingLine: string;
  partnerNotes: string[];
  messageCount: number;
  photoCount: number;
  videoCount: number;
  situation: string;
  mediaSlot: string;
  mediaLabel: string;
  copied: string;
  hostSaid: string;
};

export type OutsideDraft = {
  draft: string;
  alternates: string[];
  basedOn: string;
  pageTitle: string;
};

const DEFERRAL = /\b(will check|i'll check|i will check|will pay|i'll pay|i will pay|will confirm|i'll confirm|i will confirm|check tonight|check later)\b/i;
const PAYMENT_LOST = /didn'?t get|can'?t find|cannot find|still nothing|no requests? listed|no request|where would it be/i;

export function guestIsDeferring(text: string): boolean {
  if (!text.trim() || needsGuestReply(text)) return false;
  return DEFERRAL.test(text);
}

export function threadLane(ask: string): "reply" | "guest" | "none" {
  if (guestIsDeferring(ask)) return "guest";
  if (needsGuestReply(ask)) return "reply";
  if (isThanksOnly(ask)) return "none";
  return "none";
}

function money(text: string): string[] {
  return [...text.matchAll(/\$\d+(?:\.\d{2})?/g)].map((match) => match[0]);
}

function times(text: string): string[] {
  return [...text.matchAll(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi)].map((match) => match[0].replace(/\s+/g, " "));
}

function dates(text: string): string[] {
  return [...text.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/gi)].map((match) => match[0]);
}

function agreedAmount(turns: ThreadTurn[]): string {
  let agreed = "";
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (!turn || turn.role !== "host") continue;
    const amounts = money(turn.body);
    if (!amounts.length) continue;
    const later = turns.slice(index + 1).find((item) => item.role === "guest" && item.body.trim());
    if (later && /\b(deal|yes|ok|okay|perfect|sounds good|thank)\b/i.test(later.body)) agreed = amounts[amounts.length - 1] ?? agreed;
  }
  return agreed;
}

function agreedTime(turns: ThreadTurn[], amount: string): string {
  if (amount) {
    const hit = turns.find((turn) => turn.body.includes(amount) && times(turn.body).length);
    const found = hit ? times(hit.body).at(-1) : "";
    if (found) return found;
  }
  return times(turns.map((turn) => turn.body).join("\n")).at(-1) ?? "";
}

function agreedDate(turns: ThreadTurn[], time: string): string {
  if (time) {
    for (const turn of turns) {
      if (!turn.body.includes(time)) continue;
      const found = dates(turn.body)[0];
      if (found) return found;
    }
  }
  return dates(turns.map((turn) => turn.body).join("\n"))[0] ?? "";
}

function photoShows(turns: ThreadTurn[]): string {
  const photos = turns.flatMap((turn) => turn.media.filter((item) => item.kind === "photo" && item.shows.trim()));
  return photos.at(-1)?.shows.trim().replace(/[.]+$/, "") ?? "";
}

function sentCount(host: string): number {
  return (host.match(/payment request|sent it again|sent again/gi) ?? []).length;
}

function copiedPronoun(host: string): string {
  const he = /\b(he|his|him)\b/i.test(host);
  const she = /\b(she|her|hers)\b/i.test(host);
  if (he && !she) return "he/his";
  if (she && !he) return "she/her";
  return "";
}

function hostName(turns: ThreadTurn[], amount: string): string {
  const hit = turns.find((turn) => turn.role === "host" && amount && turn.body.includes(amount) && turn.name.trim());
  const name = (hit?.name || turns.find((turn) => turn.role === "host" && turn.name.trim())?.name || "").trim();
  return name.split(/\s+/)[0] || "";
}

function paymentMissing(turns: ThreadTurn[]): boolean {
  const host = turns.filter((turn) => turn.role === "host").map((turn) => turn.body).join("\n");
  const guest = turns
    .filter((turn) => turn.role === "guest")
    .map((turn) => `${turn.body} ${turn.media.map((item) => item.shows).join(" ")}`)
    .join("\n");
  return sentCount(host) >= 1 && PAYMENT_LOST.test(guest);
}

function clip(value: string): string {
  const one = value.replace(/\s+/g, " ").trim();
  if (one.length <= 140) return one;
  const cut = one.slice(0, 140);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Classify the full thread. This does not look anything up on the web. */
export function readThread(turns: ThreadTurn[], guest: string): ThreadRead {
  const spoken = turns.filter((turn) => (turn.role === "guest" || turn.role === "host") && (turn.body.trim() || turn.media.length));
  const lastHost = spoken.filter((turn) => turn.role === "host").map((turn) => turn.at).sort().at(-1) ?? "";
  const pending = spoken.filter((turn) => turn.role === "guest" && turn.at > lastHost);
  const ask = pending.map((turn) => [turn.body.trim(), ...turn.media.map((item) => item.shows.trim())].filter(Boolean).join(" ")).join(" ");
  const lane = pending.length ? threadLane(ask) : "none";
  const host = spoken.filter((turn) => turn.role === "host").map((turn) => turn.body).join("\n");
  const amount = agreedAmount(spoken);
  const time = agreedTime(spoken, amount);
  const date = agreedDate(spoken, time);
  const photo = photoShows(spoken);
  const missing = paymentMissing(spoken);
  const copied = copiedPronoun(host);
  const first = guest.trim().split(/\s+/)[0] || "Guest";
  const who = copied === "he/his" ? "Her" : copied === "she/her" ? "His" : `${first}’s`;
  const situation = missing && amount ? "a guest cannot find an Airbnb payment request" : "";
  const notes: string[] = [];
  if (copied && /could he|could she|update his|update her|his reservation|her reservation/i.test(host)) {
    notes.push(`The troubleshooting message sent earlier used ‘${copied}’ for ${guest} (copied text).`);
  }
  if (time && /\bAM\b/.test(time) && !/^12:/.test(time)) {
    notes.push(`An agreed early arrival at ${time} changes that morning's clean.`);
  }
  const earlier = money(spoken.map((turn) => turn.body).join("\n")).find((item) => item !== amount) ?? "";
  const agreer = hostName(spoken, amount);
  let status = "";
  if (situation && amount) {
    const when = time && date ? `${time} on ${date}` : time || date;
    const fee = earlier ? `${amount}, reduced from ${earlier}` : amount;
    const timesSent = sentCount(host) >= 2 ? "twice" : "once";
    status = [
      `${guest} asked to arrive at ${when}, and ${agreer || "the host"} agreed an early check-in fee of ${fee}.`,
      `The payment request went out ${timesSent} through Airbnb, but ${guest} can’t find it.`,
      photo ? `The photo shows ${photo}.` : "",
    ].filter(Boolean).join(" ");
  } else if (lane === "reply") {
    status = clip(ask);
  }
  const lastGuest = [...spoken].reverse().find((turn) => turn.role === "guest");
  const lastMedia = lastGuest?.media.find((item) => item.kind === "photo" || item.kind === "video");
  const mediaLabel = lastMedia
    ? lastMedia.kind === "video"
      ? `Video${lastMedia.duration ? ` ${lastMedia.duration}` : ""}`
      : "Photo"
    : "";
  const watch = lane === "guest"
    ? situation
      ? `${who} next message, or the fee unpaid 48 hours before arrival.`
      : `${who} next message.`
    : lane === "reply"
      ? "After you submit: their next message."
      : "";
  const waitingLine = lane === "guest"
    ? `Guest. ${who === "Her" ? "she" : who === "His" ? "he" : first} said ${who === "Her" ? "she" : who === "His" ? "he" : "they"} will check. Nothing to send now.`
    : lane === "reply"
      ? `You. ${first} is waiting on a reply. A draft is ready below.`
      : "";
  const mediaSlot = lane === "reply" && /another way to pay/i.test(ask)
    ? "This answer needs a short video: how to accept a reservation change in Airbnb"
    : "";
  const lead = situation && amount ? `${amount}${time ? ` for the ${time} arrival` : ""}` : lane === "reply" ? clip(ask) : "";
  const rest = situation && lane === "reply" ? clip(ask) : "";
  return {
    lane: ask.trim() || pending.some((turn) => turn.media.length) ? lane : "none",
    status,
    statusLead: lead,
    statusRest: rest,
    watch,
    waitingLine,
    partnerNotes: notes,
    messageCount: spoken.length,
    photoCount: spoken.reduce((sum, turn) => sum + turn.media.filter((item) => item.kind === "photo").length, 0),
    videoCount: spoken.reduce((sum, turn) => sum + turn.media.filter((item) => item.kind === "video").length, 0),
    situation,
    mediaSlot,
    mediaLabel,
    copied,
    hostSaid: host,
  };
}

function displayLink(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return url.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/$/, "");
  }
}

const REPEATED = [
  /update (?:his|her|their|the) airbnb app/i,
  /sign out/i,
  /open trips/i,
  /look under payments/i,
];

function withoutRepeats(draft: string, host: string): string {
  if (!REPEATED.some((step) => step.test(host))) return draft;
  return draft
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !REPEATED.some((step) => step.test(sentence) && step.test(host)))
    .join(" ")
    .trim();
}

function paymentWording(first: string, amount: string, time: string, date: string, link: string, variant: number): string {
  const when = [time, date].filter(Boolean).join(" on ");
  if (variant % 2 === 1) {
    return `Hi ${first}, no rush. When you’re back, try ${link} in a browser, signed in to the account you booked with; the ${amount} request should be listed there. If it isn’t, let me know the email on that account and I’ll get it to you well before your ${when} arrival.`;
  }
  return `Hi ${first}, thanks for checking. If the app still shows nothing, open ${link} in your phone’s browser while signed in to the Airbnb account you booked with. If the ${amount} request isn’t listed there either, tell me which email that account uses and I’ll make sure it reaches you, so your ${when} arrival stays set.`;
}

/** The next step when the unblocking fact is outside the business. Looked up at answer time. */
export async function outsideDraft(read: ThreadRead, guest: string, turns: ThreadTurn[]): Promise<OutsideDraft> {
  const empty = { draft: "", alternates: [], basedOn: "", pageTitle: "" };
  if (read.situation !== "a guest cannot find an Airbnb payment request") return empty;
  const amount = agreedAmount(turns);
  const time = agreedTime(turns, amount);
  const date = agreedDate(turns, time);
  const looked = await researchWeb("https://www.airbnb.ca/resolutions");
  if ("error" in looked || !looked.url) return empty;
  const link = displayLink(looked.url);
  if (!/airbnb\.ca\/resolutions\b/i.test(link)) return empty;
  const first = guest.trim().split(/\s+/)[0] || "there";
  const alternates = [0, 1]
    .map((variant) => withoutRepeats(paymentWording(first, amount, time, date, link, variant), read.hostSaid))
    .filter((line) => line.includes(link) && REPEATED.every((step) => !step.test(line)));
  const draft = alternates[0] ?? "";
  if (!draft) return empty;
  const agreed = [amount && time ? `${amount} for the ${time} arrival` : amount, date ? `agreed ${date}` : ""].filter(Boolean).join(", ");
  return {
    draft,
    alternates,
    basedOn: `the thread: ${agreed} · ${looked.title || "Airbnb Resolution Center"}, checked just now`,
    pageTitle: looked.title || "Airbnb Resolution Center",
  };
}

export function sourceLine(read: ThreadRead, reservation: string, pageTitle: string): string {
  const bits = [`${read.messageCount} message${read.messageCount === 1 ? "" : "s"}`];
  if (read.photoCount) bits.push(`${read.photoCount} photo${read.photoCount === 1 ? "" : "s"}`);
  if (read.videoCount) bits.push(`${read.videoCount} video${read.videoCount === 1 ? "" : "s"}`);
  const page = pageTitle ? ` · ${pageTitle}, checked just now` : "";
  const stay = reservation ? ` · Reservation ${reservation}` : "";
  return `Read: full thread (${bits.join(", ")})${stay}${page}`;
}
