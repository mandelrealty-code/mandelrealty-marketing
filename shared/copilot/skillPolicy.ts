/**
 * What a skill is allowed to do, read off the partner's own words and the skill's fields. Pure: no model, no store.
 *
 * Handling, from how the partner said it:
 *   "tell me when..." / "let me know"      -> notify: reads, reports, nothing else
 *   "ask me first" / "check with me"       -> ask: reads, and drafts that wait for the partner
 *   "just handle it" / "go ahead"          -> autonomous: also the internal things it may do on its own
 * Nothing here ever sends outside the company. Anything for a guest, a client, a building or a third party still waits for
 * a partner to press Submit, whatever the handling, and nothing is ever purchased.
 */

export type Handling = "ask" | "notify" | "autonomous";

const AUTONOMOUS = /\b(just (handle|do|take care of|sort|deal with)|handle (it|this|them|those|these|everything) (yourself|for me|on your own)|go ahead and|do it (yourself|for me)|no need to (ask|check)|without (asking|checking)|on your own|autonomous(ly)?|take care of (it|this|them)|sort (it|this|them) out)\b/i;
const ASK = /\b(ask me|check with me|run it by me|confirm with me|before you (do|send|book|change|reply|act)|wait for me|get my (ok|okay|approval)|let me approve|for my approval)\b/i;
const NOTIFY = /\b(tell me when|tell me if|let me know|text me|notify me|alert me|ping me|message me when|warn me|flag (it|them|this)|remind me)\b/i;

/** How the partner wants it handled, from their words. Asking first when the words don't say. */
export function detectHandling(words: string): Handling {
  if (AUTONOMOUS.test(words)) return "autonomous";
  if (ASK.test(words)) return "ask";
  if (NOTIFY.test(words)) return "notify";
  return "ask";
}

/** True when the words say how to handle it, as opposed to the default. */
export function sayHandling(words: string): boolean {
  return AUTONOMOUS.test(words) || ASK.test(words) || NOTIFY.test(words);
}

export const HANDLING_LINE: Record<Handling, string> = {
  ask: "Handling: asks first.",
  notify: "Handling: tells you, does nothing else.",
  autonomous: "Handling: handles it within what it may touch.",
};

const MARK = /Handling:\s*(asks first|tells you[^.]*|handles it[^.]*)\.?/i;

/** The skill's `drafts` text with its handling stated once, as a sentence the partner can read on the card. */
export function withHandling(drafts: string, handling: Handling): string {
  const rest = drafts.replace(MARK, "").replace(/\s{2,}/g, " ").trim();
  return `${rest}${rest && !/[.!?]$/.test(rest) ? "." : ""} ${HANDLING_LINE[handling]}`.trim();
}

/** The handling written on a saved skill, or "" for a skill saved before handling existed (which keeps its old behavior). */
export function handlingOf(skill: { drafts: string }): Handling | "" {
  const found = MARK.exec(skill.drafts)?.[1]?.toLowerCase() ?? "";
  if (found.startsWith("asks")) return "ask";
  if (found.startsWith("tells")) return "notify";
  if (found.startsWith("handles")) return "autonomous";
  return "";
}

// ---------- What it may touch ----------

type Group = "guests" | "mail" | "web" | "business";

const GROUP_TOOLS: Record<Group, string[]> = {
  guests: ["guest_inbox", "list_stays", "next_stays", "read_guest_messages", "guest_contacts", "unit_facts", "hospitable_read"],
  mail: ["search_mail", "read_mail", "last_sent_email"],
  web: ["research_web"],
  business: ["ops_clients", "ops_revenue", "cleaner_read", "market_comps", "resolve_client", "sheet_read"],
};
const GROUP_WORDS: Record<Group, RegExp> = {
  guests: /\b(hospitable|guest|reservation|stay|check-?in|check-?out|review|inquir|booking|message|thread|airbnb|arriv)/i,
  mail: /\b(gmail|outlook|mail|email|inbox|sent)\b/i,
  web: /\b(web|online|internet|page|site|link|amazon|facebook|marketplace|browse)/i,
  business: /\b(clean|unit|propert|revenue|client|owner|supply|supplies|stock|calendar|task|comps?|market|rate|earning|statement|contract)/i,
};
/** Read-only and always fine: what the business knows, what is connected, the public web. */
const ALWAYS = ["recall_facts", "connector_status", "web_lookup", "post_report", "deliver_to_partners", "find_furniture", "furniture_revise", "furniture_stores", "furniture_report"];
/** Things a skill does inside the company on its own when it is told to handle it. Each still waits for Submit if it reaches anyone outside. */
const INTERNAL_WRITES = ["add_reminder", "make_pdf", "sheet_write", "amend_contract", "assign_cleaner", "create_sop", "build_proposal", "edit_proposal", "send_proposal"];

export function touchGroups(reads: string): Set<Group> {
  const found = new Set<Group>();
  for (const group of Object.keys(GROUP_WORDS) as Group[]) if (GROUP_WORDS[group].test(reads)) found.add(group);
  return found;
}

/**
 * The tools a skill may call: the groups its "reads" names (everything it can read when it names none), plus handling.
 * A skill saved before handling existed ("") keeps every tool, as it always had.
 */
export function allowedToolNames(skill: { reads: string; drafts: string }, available: string[]): string[] {
  const handling = handlingOf(skill);
  const groups = touchGroups(skill.reads);
  const reads = groups.size ? [...groups].flatMap((group) => GROUP_TOOLS[group]) : Object.values(GROUP_TOOLS).flat();
  const names = new Set<string>([...ALWAYS, ...reads]);
  if (handling !== "notify") names.add("propose_draft");
  if (handling === "autonomous" || handling === "") for (const name of INTERNAL_WRITES) names.add(name);
  if (handling === "") {
    // Saved before handling existed: every tool, as before.
    return available;
  }
  return available.filter((name) => names.has(name));
}
