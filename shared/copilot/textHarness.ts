/**
 * Texting the partner: only their own numbers on file, only when asked or when a saved step says so, never at night unless
 * urgent, every text logged. No text leaves: parity records what Twilio would have sent.
 */

import { agentSystem, agentTools, runAgentTurn } from "./agentChat.js";
import { setBrainModel, type BrainRequest } from "./brain.js";
import { resetBusinessFacts } from "./businessFacts.js";
import { setParityClock } from "./parity/clock.js";
import { capturedCommits, resetCaptures } from "./parity/capture.js";
import { installWorld } from "./parity/world.js";
import { asksForText, partnerNumbers, recentTexts } from "./partnerText.js";
import { deliverToPartners, capturedPartnerDeliveries, resetPartnerDeliveries, setTextChannel } from "./skillDelivery.js";
import { startSkillRun } from "./skillRunner.js";
import { allowedToolNames } from "./skillPolicy.js";
import { addTextNumber, listChats, listMessages, listSkills, removeTextNumber, resetParityText, saveSkill } from "./store.js";
import type { CopilotSkill } from "./types.js";
import type { Workflow } from "./workflow.js";

function fail(label: string): never {
  throw new Error(`Text harness failed: ${label}`);
}

installWorld({ now: new Date("2026-11-02T12:00:00-05:00"), properties: [], reservations: [], gmail: [], outlook: [], memory: [], items: [] });
resetBusinessFacts();
resetCaptures();
resetPartnerDeliveries();
resetParityText();
setBrainModel(null);

const DAY = new Date("2026-11-02T15:00:00Z"); // 10 AM Toronto
const NIGHT = new Date("2026-11-03T04:30:00Z"); // 11:30 PM Toronto
setParityClock(DAY);

type Out = { sent: boolean; reason?: string; note?: string; to?: string };
const chatTools = (said: string) => agentTools({ partnerText: said });
const chatText = async (said: string, input: Record<string, unknown>) => (await chatTools(said).find((tool) => tool.name === "send_text")!.run(input, "text-chat")) as Out;

// ---------- Nothing is wired until Twilio and a number are there ----------
let out = await chatText("text me the total", { body: "The total is $28.25." });
if (out.sent || !/not configured/i.test(out.note ?? "")) fail(`with no Twilio: ${JSON.stringify(out)}`);
setTextChannel(true);
out = await chatText("text me the total", { body: "The total is $28.25." });
if (out.sent || out.reason !== "no-number" || !/No partner number is on file/.test(out.note ?? "")) fail(`with no number on file: ${JSON.stringify(out)}`);

// ---------- Only the partners' own numbers ----------
await addTextNumber("(917) 555-0142");
if ((await partnerNumbers()).join() !== "+19175550142") fail("numbers on file");
out = await chatText("text me the total", { body: "The total is $28.25." });
if (!out.sent || out.to !== "+19175550142") fail(`one number on file, so "me" is clear: ${JSON.stringify(out)}`);
let sent = capturedPartnerDeliveries();
if (sent.length !== 1 || sent[0]!.channel !== "text" || sent[0]!.to !== "+19175550142" || sent[0]!.body !== "The total is $28.25.") fail(`what was sent: ${JSON.stringify(sent)}`);
out = await chatText("text me the total", { body: "Hi", to: "+14165550199" });
if (out.sent || out.reason !== "not-partner" || !/isn't a partner number on file/.test(out.note ?? "")) fail(`a number that isn't a partner's: ${JSON.stringify(out)}`);
out = await chatText("text me", { body: "Hi", to: "416-555-0199" });
if (out.sent || capturedPartnerDeliveries().length !== 1) fail("a guest's number was texted");
await addTextNumber("(647) 555-0100");
out = await chatText("text me the total", { body: "Hi" });
if (out.sent || out.reason !== "ambiguous" || !/Which one\?/.test(out.note ?? "") || /5550100|5550142/.test(out.note ?? "")) fail(`two numbers, no choice: ${JSON.stringify(out)}`);
out = await chatText("text me the total", { body: "Hi", to: "(647) 555-0100" });
if (!out.sent || out.to !== "+16475550100") fail(`naming one of two: ${JSON.stringify(out)}`);

// ---------- Only when asked ----------
for (const said of ["text me", "send me the total", "can you text me that?", "send it to my phone", "ping me when it's done"]) if (!asksForText(said)) fail(`"${said}" is a request to text`);
for (const said of ["what's the weather", "draft a reply to Brennan", "how many checkouts today"]) if (asksForText(said)) fail(`"${said}" is not a request to text`);
const before = capturedPartnerDeliveries().length;
out = await chatText("how many checkouts are there today", { body: "Two checkouts.", to: "(917) 555-0142" });
if (out.sent || out.reason !== "not-asked" || capturedPartnerDeliveries().length !== before) fail(`unprompted in open chat: ${JSON.stringify(out)}`);

// ---------- Quiet hours: a saved skill's text waits; a partner asking in the chat is heard ----------
setParityClock(NIGHT);
const skill = { id: "sk-1", name: "Cleaner check", when_text: "Every night, text me if a clean ran late", reads: "cleaner app", drafts: "Handling: tells you only.", chat_id: "skill-chat", phone: "", kind: "playbook", enabled: true } as unknown as CopilotSkill;
const skillText = (input: Record<string, unknown>) => (agentTools({ run: { id: "r" } as never, skill }).find((tool) => tool.name === "send_text")!.run(input, "skill-chat")) as Promise<Out>;
const sentBefore = capturedPartnerDeliveries().length;
out = await skillText({ body: "The 5A clean ran two hours late.", to: "(917) 555-0142" });
if (out.sent || out.reason !== "quiet-hours" || !/quiet hours/.test(out.note ?? "") || capturedPartnerDeliveries().length !== sentBefore) fail(`a night text from a skill: ${JSON.stringify(out)}`);
if (!(await listMessages("skill-chat")).some((row) => /Held for the morning \(quiet hours\)/.test(row.body) && /5A clean ran two hours late/.test(row.body))) fail("the held text wasn't kept in the app");
out = await skillText({ body: "Smoke alarm in 5A.", to: "(917) 555-0142", urgent: true });
if (!out.sent) fail(`an urgent night text: ${JSON.stringify(out)}`);
out = await chatText("text me the total please", { body: "Total is $28.25.", to: "(917) 555-0142" });
if (!out.sent) fail(`the partner asking at night: ${JSON.stringify(out)}`);
setParityClock(DAY);
// A skill that isn't about texting can't.
const quiet = { ...skill, name: "Inbox check", when_text: "Every morning", reads: "gmail", drafts: "Handling: tells you only." } as CopilotSkill;
const refusedSkill = (await agentTools({ run: { id: "r" } as never, skill: quiet }).find((tool) => tool.name === "send_text")!.run({ body: "x", to: "(917) 555-0142" }, "c")) as Out;
if (refusedSkill.sent || refusedSkill.reason !== "not-asked") fail(`a skill that doesn't text: ${JSON.stringify(refusedSkill)}`);
const names = agentTools({ run: { id: "r" } as never, skill }).map((tool) => tool.name);
if (!allowedToolNames(skill, names).includes("send_text") || allowedToolNames(quiet, names).includes("send_text")) fail("a skill is offered send_text only when its own words say it texts");

// ---------- Every text is logged: to, when, the first 100 characters ----------
const long = "A".repeat(140);
await chatText("text me the report", { body: long, to: "(917) 555-0142" });
const log = await recentTexts(50);
const newest = log.find((row) => row.preview.startsWith("AAAA"))!;
if (!newest || newest.to !== "+19175550142" || newest.preview !== "A".repeat(100) || !Number.isFinite(Date.parse(newest.at))) fail(`the log: ${JSON.stringify(newest)}`);
if (log.length !== 5) fail(`every sent text is logged and nothing refused is: ${log.length}`);
const asked = (await chatTools("what did you text me?").find((tool) => tool.name === "sent_texts")!.run({}, "c")) as { texts: unknown[] };
if (asked.texts.length !== 5) fail("sent_texts");
// A runaway is stopped.
for (let i = 0; i < 12; i += 1) out = await chatText("text me", { body: `Note ${i}`, to: "(917) 555-0142" });
if (out.sent || out.reason !== "rate-limit") fail(`a runaway: ${JSON.stringify(out)}`);

// ---------- The skill-delivery path is the same safe sender ----------
resetPartnerDeliveries();
resetParityText();
await addTextNumber("(917) 555-0142");
setTextChannel(true);
const viaDelivery = async (phone: string) => (await deliverToPartners({ skill: { ...skill, phone, chat_id: "" }, headline: "Draft ready", text: "A reply is waiting.", channels: ["text"] })).notes.join(" ");
if (!/Texted the partner/.test(await viaDelivery("(917) 555-0142")) || capturedPartnerDeliveries().length !== 1) fail("deliver_to_partners texting a number on file");
if (!/isn't a partner number on file/.test(await viaDelivery("(212) 555-0111")) || capturedPartnerDeliveries().length !== 1) fail("deliver_to_partners texted a number that isn't on file");

// ---------- The workflow's "Text me" step ----------
const wf = (id: string, number: string): Workflow => ({
  id, name: "Text me when ready", boundary: "Texts the partner.", memory: "", on: true,
  nodes: [{ id: "n1", fn: "When", note: "Each morning", field: "8:00 each morning", x: 0, y: 0 }, { id: "n2", fn: "Text me", note: "That the list is ready", field: number, x: 0, y: 220 }],
  edges: [{ id: "e1", from: "n1", to: "n2" }],
});
const script = (request: BrainRequest) => {
  if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" as const };
  const followUp = Array.isArray(request.messages!.at(-1)!.content);
  if (followUp) return { text: "Texted.", toolUses: [], blocks: [{ type: "text" as const, text: "Texted." }], stop: "end_turn" as const };
  // The step is offered only the texting tool, and it names no number: the step's own number is used.
  if (!(request.tools ?? []).every((tool) => tool.name === "send_text")) return { text: "WRONG TOOLS", toolUses: [], blocks: [], stop: "end_turn" as const };
  return { text: "", toolUses: [{ id: "s1", name: "send_text", input: { body: "Your list is ready." } }], blocks: [{ type: "tool_use" as const, id: "s1", name: "send_text", input: { body: "Your list is ready." } }], stop: "tool_use" as const };
};
const base = { when_text: "Every morning", enabled: true, kind: "playbook" as const, schedule: "daily" as const, phone: "", reads: "Hospitable", drafts: "A text", must_not: "Send anything" };
resetPartnerDeliveries();
setTextChannel(true);
setBrainModel(async (request) => script(request));
const good = await saveSkill({ ...base, name: "Text on file", workflow: wf("wf-good", "(917) 555-0142") });
const ran = await startSkillRun(good.id, "manual");
const texts = capturedPartnerDeliveries();
if (ran.status !== "ok" || texts.length !== 1 || texts[0]!.to !== "+19175550142" || !/Your list is ready/.test(texts[0]!.body)) fail(`the Text me step: ${ran.status} ${ran.error} ${JSON.stringify(texts)}`);
const other = await saveSkill({ ...base, name: "Text a stranger", workflow: wf("wf-bad", "(212) 555-0111") });
const refused = await startSkillRun(other.id, "manual");
if (refused.status !== "failed" || !/isn't a partner number on file/.test(refused.error ?? "") || capturedPartnerDeliveries().length !== 1) fail(`a Text me step with a number that isn't on file: ${refused.status} ${refused.error}`);
// At night the step holds its text and says so; it isn't a failure.
setParityClock(NIGHT);
const night = await saveSkill({ ...base, name: "Text at night", workflow: wf("wf-night", "(917) 555-0142") });
const held = await startSkillRun(night.id, "manual");
if (held.status !== "ok" || capturedPartnerDeliveries().length !== 1) fail(`a Text me step at night: ${held.status} ${held.error}`);
const nightChat = (await listSkills()).find((row) => row.id === night.id)?.chat_id ?? "";
if (!(await listMessages(nightChat)).some((row) => /Held for the morning/.test(row.body))) fail("a held Text me wasn't kept in the app");
void listChats;
setParityClock(DAY);
setBrainModel(null);

// ---------- The agent is told the rules, and Twilio is no longer unwired ----------
const rules = agentSystem("", "2026-11-02");
if (!/TEXTING:/.test(rules) || !/never unprompted/.test(rules) || !/refuses any other number/.test(rules)) fail("the agent isn't told the texting rules");
if (!agentTools({ partnerText: "text me" }).some((tool) => tool.name === "send_text")) fail("chat has no send_text");
if (capturedCommits().length) fail("texting committed something");
await removeTextNumber("(917) 555-0142");
await removeTextNumber("(647) 555-0100");
void runAgentTurn;

console.log("Text harness passed.");
