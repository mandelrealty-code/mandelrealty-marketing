/**
 * Skills and workflows through the agent loop: drafting from chat, running saved skills, running builder steps in order with
 * context carried, pausing at "Wait for you", and failure reports that say exactly where. Nothing is sent. No real API is called.
 */

import { agentSystem, agentTools, runAgentTurn } from "./agentChat.js";
import { setBrainModel, type BrainRequest } from "./brain.js";
import { resetBusinessFacts } from "./businessFacts.js";
import { capturedCommits, capturedDrafts, resetCaptures } from "./parity/capture.js";
import { installWorld } from "./parity/world.js";
import { addTextNumber } from "./store.js";
import { capturedPartnerDeliveries, resetPartnerDeliveries, setTextChannel } from "./skillDelivery.js";
import { failure, failureText, fixFor } from "./skillFailure.js";
import { stepOrder, stepsAfter } from "./skillAgent.js";
import { allowedToolNames, detectHandling, handlingOf, sayHandling, withHandling } from "./skillPolicy.js";
import { startSkillRun } from "./skillRunner.js";
import { listChats, listMessages, listSkills, saveSkill, setParityMailLogin } from "./store.js";
import { setWebAnswerer } from "./webAnswer.js";
import type { Workflow } from "./workflow.js";

function fail(label: string): never {
  throw new Error(`Agent skills harness failed: ${label}`);
}

installWorld({ now: new Date("2026-10-20T15:00:00-04:00"), properties: [], reservations: [], gmail: [], outlook: [], memory: [], items: [] });
resetBusinessFacts();
resetCaptures();
resetPartnerDeliveries();
setBrainModel(null);

// ---------- How the partner wants it handled comes from their words ----------
const cases: [string, ReturnType<typeof detectHandling>][] = [
  ["Check every morning if a guest is waiting and tell me when there is one", "notify"],
  ["Let me know if a review comes in under 4 stars", "notify"],
  ["Every Monday, just handle the cleaner assignments for next week", "autonomous"],
  ["Go ahead and keep the grocery list updated without asking", "autonomous"],
  ["Check the inquiries and ask me before you reply to any", "ask"],
  ["Watch the parking emails", "ask"],
];
for (const [words, expected] of cases) if (detectHandling(words) !== expected) fail(`"${words}" read as ${detectHandling(words)}, not ${expected}`);
if (sayHandling("Watch the parking emails") || !sayHandling("tell me when it happens")) fail("sayHandling");
const stated = withHandling("A short report.", "notify");
if (stated !== "A short report. Handling: tells you, does nothing else." || handlingOf({ drafts: stated }) !== "notify") fail(`withHandling: ${stated}`);
if (withHandling(stated, "autonomous") !== "A short report. Handling: handles it within what it may touch." || handlingOf({ drafts: withHandling(stated, "autonomous") }) !== "autonomous") fail("handling is stated twice or not replaced");
if (handlingOf({ drafts: "A report for the partners" }) !== "") fail("a skill with no handling line must keep its old behavior");

// ---------- What a skill may touch ----------
const everything = ["guest_inbox", "list_stays", "read_guest_messages", "search_mail", "read_mail", "web_lookup", "research_web", "ops_revenue", "cleaner_read", "post_report", "deliver_to_partners", "propose_draft", "add_reminder", "sheet_write", "assign_cleaner", "recall_facts"];
const notify = allowedToolNames({ reads: "Hospitable guest messages", drafts: withHandling("A report", "notify") }, everything);
if (notify.includes("propose_draft") || notify.includes("add_reminder") || notify.includes("assign_cleaner") || notify.includes("search_mail") || !notify.includes("guest_inbox") || !notify.includes("post_report") || !notify.includes("web_lookup")) fail(`notify tools: ${notify.join()}`);
const ask = allowedToolNames({ reads: "Gmail and Outlook", drafts: withHandling("Drafts", "ask") }, everything);
if (!ask.includes("propose_draft") || ask.includes("add_reminder") || ask.includes("guest_inbox") || !ask.includes("search_mail")) fail(`ask tools: ${ask.join()}`);
const auto = allowedToolNames({ reads: "The units and cleaners", drafts: withHandling("Assignments", "autonomous") }, everything);
if (!auto.includes("assign_cleaner") || !auto.includes("add_reminder") || !auto.includes("cleaner_read") || auto.includes("search_mail")) fail(`autonomous tools: ${auto.join()}`);
if (allowedToolNames({ reads: "anything", drafts: "A report for the partners" }, everything).length !== everything.length) fail("a skill saved before handling lost tools");

// ---------- Failures say where, what was tried, what came back, and a fix ----------
const hos = failure({ where: "step 2 of 4 (Read: Review inbox)", tried: "hospitable_read get-reservations", cameBack: "Hospitable is not connected, so that read is not available." });
if (hos.suggestion !== "Connect Hospitable in Settings, then Connectors.") fail(`fix: ${hos.suggestion}`);
if (fixFor("Gmail rejected the saved sign-in") !== "Open Settings, then Connectors, and press Connect to sign in again.") fail("reauth fix");
if (fixFor("something nobody has seen before") !== "") fail("a fix was invented");
const text = failureText("Review text", hos);
if (!/Review text stopped at step 2 of 4/.test(text) || !/What it tried: hospitable_read get-reservations/.test(text) || !/What came back: Hospitable is not connected/.test(text) || !/Suggested fix:/.test(text) || !/Nothing was sent/.test(text)) fail(`failure text: ${text}`);

// ---------- Drafting a skill from chat ----------
function skillBrain(args: Record<string, unknown>): () => void {
  let step = 0;
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    step += 1;
    if (step === 1) return { text: "", toolUses: [{ id: "k1", name: "propose_skill", input: args }], blocks: [{ type: "tool_use", id: "k1", name: "propose_skill", input: args }], stop: "tool_use" };
    return { text: "Here it is. Nothing is saved until you press Save.", toolUses: [], blocks: [{ type: "text", text: "Here it is. Nothing is saved until you press Save." }], stop: "end_turn" };
  });
  return () => setBrainModel(null);
}
async function draftedFrom(said: string, args: Record<string, unknown>, chatId: string) {
  const done = skillBrain(args);
  const before = (await listSkills()).length;
  const turn = await runAgentTurn({ chatId, text: said });
  done();
  if ((await listSkills()).length !== before) fail("drafting a skill saved it");
  const card = (await listMessages(chatId)).find((row) => row.draft?.channel === "skill")?.draft;
  if (!card || card.status !== "waiting") fail(`no skill card was left for ${said}`);
  return { card, turn };
}
const watch = await draftedFrom("Check every morning if any guest is waiting on a reply and tell me when there is one", { name: "Waiting guests", reads: "Guest messages in Hospitable", leaves: "A short list of who is waiting", handling: "autonomous" }, "chat-watch");
if (watch.card.skillSchedule !== "daily" || !/Handling: tells you/.test(watch.card.skillDrafts ?? "") || !/Never purchase anything/.test(watch.card.skillMustNot ?? "") || !/Submit/.test(watch.card.skillMustNot ?? "")) fail(`watch card: ${JSON.stringify(watch.card)}`);
if (handlingOf({ drafts: watch.card.skillDrafts ?? "" }) !== "notify") fail("the partner's 'tell me when' did not beat the model's guess of autonomous");
const handle = await draftedFrom("Every Monday, just handle the cleaner assignments for next week", { name: "Weekly cleaner assignments", reads: "Next week's turnovers and the cleaners", leaves: "Assignments ready to confirm", when: "every Monday" }, "chat-handle");
if (handle.card.skillSchedule !== "weekly:Monday" || handlingOf({ drafts: handle.card.skillDrafts ?? "" }) !== "autonomous") fail(`handle card: ${JSON.stringify(handle.card)}`);
const unsaid = await draftedFrom("Watch the parking emails for building replies", { name: "Parking emails", reads: "Gmail and Outlook", leaves: "A note when a reply arrives" }, "chat-ask");
if (unsaid.card.skillSchedule !== "" || handlingOf({ drafts: unsaid.card.skillDrafts ?? "" }) !== "ask") fail(`unsaid card: ${JSON.stringify(unsaid.card)}`);
if (!/never sends to a guest/i.test(handle.turn.body + (await listMessages("chat-handle")).map((row) => row.body).join(" "))) fail("the card's words don't say it never sends");
if (!/call propose_skill/.test(agentSystem("", "2026-10-20"))) fail("the agent isn't told when to draft a skill");
if (!agentTools({ partnerText: "x" }).some((tool) => tool.name === "propose_skill") || agentTools().some((tool) => tool.name === "propose_skill")) fail("propose_skill belongs to chat only");

// ---------- A saved skill runs through the same loop, with only what it may touch ----------
setWebAnswerer(async () => "Searched the web: the city licence page lists a fee of $450.");
let seen: BrainRequest[] = [];
function runBrain(script: (request: BrainRequest, step: number) => { text: string; tool?: { name: string; input: Record<string, unknown> } }): void {
  let step = 0;
  seen = [];
  setBrainModel(async (request) => {
    if (request.task === "extract") return { text: "{\"facts\":[]}", toolUses: [], blocks: [], stop: "end_turn" };
    seen.push(JSON.parse(JSON.stringify(request)) as BrainRequest);
    step += 1;
    const next = script(request, step);
    const blocks = next.tool ? [{ type: "tool_use" as const, id: `t${step}`, name: next.tool.name, input: next.tool.input }] : [{ type: "text" as const, text: next.text }];
    return { text: next.text, toolUses: next.tool ? [{ id: `t${step}`, name: next.tool.name, input: next.tool.input }] : [], blocks, stop: next.tool ? "tool_use" : "end_turn" };
  });
}
const SKILL = { when_text: "Every morning, ~5:00", enabled: true, kind: "playbook" as const, schedule: "daily" as const, phone: "" };
const licence = await saveSkill({ ...SKILL, name: "Licence watch", reads: "The city licence page on the web", drafts: withHandling("A note on the fee", "notify"), must_not: "Send anything", phone: "" });
runBrain((_request, step) => {
  if (step === 1) return { text: "", tool: { name: "web_lookup", input: { question: "What is the short-term rental licence fee in Toronto?" } } };
  if (step === 2) return { text: "", tool: { name: "post_report", input: { headline: "Licence fee $450", text: "The city page lists a $450 fee.", needs_you: false } } };
  return { text: "Report posted." };
});
const ranLicence = await startSkillRun(licence.id, "manual");
if (ranLicence.status !== "ok") fail(`licence skill: ${ranLicence.status} ${ranLicence.error}`);
const offered = (seen[0]?.tools ?? []).map((tool) => tool.name);
if (offered.includes("propose_draft") || offered.includes("add_reminder") || offered.includes("assign_cleaner") || !offered.includes("web_lookup") || !offered.includes("post_report")) fail(`a notify skill was offered: ${offered.join()}`);
const toolResult = JSON.stringify(seen[1]?.messages?.at(-1)?.content ?? "");
if (!/city licence page lists a fee of \$450/.test(toolResult)) fail("the web lookup did not run inside the skill");
if (!/NOTHING SENDS WITHOUT A PARTNER/.test(seen[0]?.system ?? "") || !/WHAT IS CONNECTED/.test(seen[0]?.system ?? "") || !/Handling: tells you/.test(seen[0]?.system ?? "")) fail("a skill does not run on the same brain rules as chat");
// The same route as a chat ask.
const chatTasks: string[] = [];
setBrainModel(async (request) => {
  if (request.task !== "extract") chatTasks.push(request.task);
  return { text: "ok", toolUses: [], blocks: [{ type: "text", text: "ok" }], stop: "end_turn" };
});
await runAgentTurn({ chatId: "same-brain", text: "hello" });
if (seen[0]?.task !== chatTasks[0] || chatTasks[0] !== "chat") fail(`a skill and a chat ask use different routes: ${seen[0]?.task} / ${chatTasks[0]}`);
// An autonomous skill is also offered what it may do on its own; an asking one is not.
const sweeps = await saveSkill({ ...SKILL, name: "Cleaner sweep", reads: "The units and cleaners", drafts: withHandling("Assignments", "autonomous"), must_not: "Send anything" });
runBrain(() => ({ text: "Nothing to do." }));
await startSkillRun(sweeps.id, "manual");
const autoOffered = (seen[0]?.tools ?? []).map((tool) => tool.name);
if (!autoOffered.includes("assign_cleaner") || !autoOffered.includes("add_reminder") || autoOffered.includes("search_mail")) fail(`an autonomous skill was offered: ${autoOffered.join()}`);
if (capturedCommits().length) fail("a skill committed something");

// ---------- A workflow: each step in order, context carried, Wait for you pauses, then it carries on ----------
const wf: Workflow = {
  id: "wf-reply",
  name: "Reply to waiting guests",
  boundary: "Texts the partner. It does not text a guest.",
  memory: "",
  on: true,
  nodes: [
    { id: "n1", fn: "When", note: "Each morning", field: "8:00 each morning", x: 0, y: 0 },
    { id: "n2", fn: "Read", note: "Who is waiting on a reply", field: "Hospitable", x: 0, y: 220 },
    { id: "n3", fn: "Look on the web", note: "The check-in rules for the building", field: "The building page", x: 0, y: 440 },
    { id: "n4", fn: "Write", note: "A short reply to the guest", field: "Short and plain", x: 0, y: 660 },
    { id: "n5", fn: "Wait for you", note: "Before the text goes out", field: "Before it moves on", x: 0, y: 880 },
    { id: "n6", fn: "Text me", note: "That the draft is ready", field: "(917) 555-0142", x: 0, y: 1100 },
  ],
  edges: [
    { id: "e1", from: "n1", to: "n2" },
    { id: "e2", from: "n2", to: "n3" },
    { id: "e3", from: "n3", to: "n4" },
    { id: "e4", from: "n4", to: "n5" },
    { id: "e5", from: "n5", to: "n6" },
  ],
};
if (stepOrder(wf).map((node) => node.id).join() !== "n1,n2,n3,n4,n5,n6") fail("step order");
if ([...stepsAfter(wf, "n5")].join() !== "n6") fail("steps after the wait");
const shuffled: Workflow = { ...wf, nodes: [wf.nodes[3]!, wf.nodes[0]!, wf.nodes[5]!, wf.nodes[1]!, wf.nodes[4]!, wf.nodes[2]!] };
if (stepOrder(shuffled).map((node) => node.id).join() !== "n1,n2,n3,n4,n5,n6") fail("step order depends on how the steps were stored");
setTextChannel(true);
await addTextNumber("(917) 555-0142");
const workflowSkill = await saveSkill({ ...SKILL, name: "Reply to waiting guests", reads: "Hospitable", drafts: "A draft reply", must_not: "Send anything", phone: "(917) 555-0142", workflow: wf });
const stepsSeen: string[] = [];
const offeredPerStep: Record<string, string[]> = {};
runBrain((request, step) => {
  const prompt = String(request.messages?.[0]?.content ?? "");
  const fn = /STEP: ([A-Za-z ]+)\./.exec(prompt)?.[1] ?? "";
  const last = request.messages!.at(-1)!;
  const isFollowUp = Array.isArray(last.content);
  if (!isFollowUp) {
    stepsSeen.push(fn);
    offeredPerStep[fn] = (request.tools ?? []).map((tool) => tool.name);
  }
  if (fn === "Read") return isFollowUp ? { text: "Eloise has waited 4 hours: 'Can we check in at 1 PM?'" } : { text: "", tool: { name: "recall_facts", input: { query: "check-in" } } };
  if (fn === "Look on the web") return { text: "The building allows check-in from 1 PM with the concierge." };
  if (fn === "Write") {
    if (!isFollowUp) {
      if (!/Eloise has waited 4 hours/.test(prompt) || !/check-in from 1 PM/.test(prompt)) return { text: "MISSING CONTEXT" };
      return { text: "", tool: { name: "propose_draft", input: { channel: "hospitable", body: "Hi Eloise, yes, 1 PM works. See you then.", hospitable_tool: "send-reservation-message", hospitable_args: { reservation_id: "r1" } } } };
    }
    return { text: "Hi Eloise, yes, 1 PM works. See you then." };
  }
  if (fn === "Text me") return isFollowUp ? { text: "Texted." } : { text: "", tool: { name: "send_text", input: { body: "A reply to Eloise is waiting for your OK." } } };
  return { text: `unexpected ${fn || step}` };
});
resetCaptures();
const first = await startSkillRun(workflowSkill.id, "manual");
if (first.status !== "ok" || !first.result?.paused) fail(`workflow first run: ${first.status} ${first.error} ${JSON.stringify(first.result)}`);
if (stepsSeen.join() !== "Read,Look on the web,Write") fail(`steps ran in this order: ${stepsSeen.join()}`);
if (first.result.paused.remaining.join() !== "n6" || first.result.paused.waitingFor !== "Before it moves on") fail(`paused: ${JSON.stringify(first.result.paused)}`);
if (!offeredPerStep["Read"]?.includes("hospitable_read") || offeredPerStep["Read"]?.includes("propose_draft") || offeredPerStep["Read"]?.includes("deliver_to_partners")) fail("the Read step was offered the wrong tools");
if (!offeredPerStep["Look on the web"]?.includes("web_lookup") || offeredPerStep["Look on the web"]?.includes("hospitable_read")) fail("the web step was offered the wrong tools");
if (!offeredPerStep["Write"]?.includes("propose_draft") || offeredPerStep["Write"]?.includes("deliver_to_partners")) fail("the Write step was offered the wrong tools");
if (capturedDrafts().length !== 1 || capturedDrafts()[0]!.needs_you !== true) fail("the Write step did not leave a draft waiting for approval");
if (capturedPartnerDeliveries().length !== 0) fail("the text went out before the partner said go");
if (capturedCommits().length) fail("a workflow committed something");
const wfChat = (await listSkills()).find((row) => row.id === workflowSkill.id)?.chat_id ?? "";
if (!(await listChats()).some((chat) => chat.id === wfChat && chat.needs_you_at)) fail("a paused workflow isn't waiting in Decisions");
// Run now again: it carries on from the pause, with what it found, and only then texts.
stepsSeen.length = 0;
const second = await startSkillRun(workflowSkill.id, "manual");
if (second.status !== "ok" || second.result?.paused) fail(`workflow resume: ${second.status} ${second.error} ${JSON.stringify(second.result?.paused)}`);
if (stepsSeen.join() !== "Text me") fail(`the resume ran: ${stepsSeen.join()}`);
const texts = capturedPartnerDeliveries();
if (texts.length !== 1 || texts[0]!.channel !== "text" || texts[0]!.to !== "+19175550142" || !/waiting for your OK/.test(texts[0]!.body)) fail(`the partner text: ${JSON.stringify(texts)}`);

// ---------- Failures: where, what it tried, what came back, a fix, and in Decisions ----------
const failing = await saveSkill({ ...SKILL, name: "Inbox check", reads: "Hospitable", drafts: "A report", must_not: "Send anything", phone: "", workflow: { ...wf, id: "wf-fail", name: "Inbox check", nodes: wf.nodes.slice(0, 3), edges: wf.edges.slice(0, 2) } });
runBrain((request) => {
  const fn = /STEP: ([A-Za-z ]+)\./.exec(String(request.messages?.[0]?.content ?? ""))?.[1] ?? "";
  const followUp = Array.isArray(request.messages!.at(-1)!.content);
  if (fn === "Read") return followUp ? { text: "I could not read it." } : { text: "", tool: { name: "read_mail", input: { mailbox: "gmail", id: "msg-1" } } };
  return { text: "ok" };
});
setParityMailLogin("gmail", null);
const broke = await startSkillRun(failing.id, "manual");
setParityMailLogin("gmail", undefined);
if (broke.status !== "failed") fail(`a failing read ended ${broke.status}`);
const failChat = (await listSkills()).find((row) => row.id === failing.id)?.chat_id ?? "";
const note = (await listMessages(failChat)).find((row) => /stopped at/.test(row.body));
if (!note || !/stopped at step 2 of 3 \(Read: Who is waiting on a reply\)/.test(note.body) || !/What it tried: read_mail gmail/.test(note.body) || !/What came back: Gmail isn't connected/i.test(note.body)) fail(`failure note: ${note?.body}`);
if (!/Suggested fix: Connect Gmail in Settings/.test(note.body)) fail(`no fix: ${note.body}`);
if (!note.report?.failed?.line || !/step 2 of 3/.test(note.report.failed.line) || !/Connect Gmail/.test(note.report.failed.sub ?? "")) fail("the failure card lacks the step or the fix");
if (!(await listChats()).some((chat) => chat.id === failChat && chat.needs_you_at)) fail("a failed workflow isn't in Decisions");
// Text me with no number.
const nonumber = await saveSkill({ ...SKILL, name: "Text without a number", reads: "Hospitable", drafts: "A text", must_not: "Send anything", phone: "", workflow: { ...wf, id: "wf-nonum", name: "Text without a number", nodes: [wf.nodes[0]!, { ...wf.nodes[5]!, id: "t1", field: "", y: 220 }], edges: [{ id: "x", from: "n1", to: "t1" }] } });
runBrain(() => ({ text: "should never run" }));
const noNum = await startSkillRun(nonumber.id, "manual");
if (noNum.status !== "failed" || !/No partner number/.test(noNum.error)) fail(`a text with no number: ${noNum.status} ${noNum.error}`);
if (seen.length) fail("the brain was called for a step that could not run");
const noNumChat = (await listSkills()).find((row) => row.id === nonumber.id)?.chat_id ?? "";
if (!(await listMessages(noNumChat)).some((row) => /Suggested fix: Add your mobile number/.test(row.body))) fail("no fix for a missing number");
// A step the brain can't answer.
runBrain(() => ({ text: "" }));
setBrainModel(async () => null);
const silent = await startSkillRun(failing.id, "manual");
if (silent.status !== "failed" || !/didn't answer/.test(silent.error)) fail(`a silent brain in a step: ${silent.status} ${silent.error}`);
// A skill that can't start is not silent either.
setBrainModel(null);
let startError = "";
try {
  await startSkillRun(licence.id, "schedule");
} catch (err) {
  startError = err instanceof Error ? err.message : "";
}
if (!/AI brain isn't connected/.test(startError)) fail(`start: ${startError}`);
const licenceChat = (await listSkills()).find((row) => row.id === licence.id)?.chat_id ?? "";
if (!(await listMessages(licenceChat)).some((row) => /stopped at the start of the run/.test(row.body) && /Suggested fix:/.test(row.body))) fail("a skill that couldn't start left no note");
setWebAnswerer(null);

console.log("Agent skills harness passed.");
