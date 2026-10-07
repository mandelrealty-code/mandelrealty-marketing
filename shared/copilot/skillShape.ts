import type { CopilotDraft, CopilotSkill } from "./types.js";
import type { FnName, Workflow, WfNode } from "./workflow.js";
import { FN } from "./workflow.js";
import { namedWeekday, normalizeSchedule, scheduleChoices, schedulePhrase } from "./skillSchedule.js";
import type { SkillSchedule } from "./types.js";

export type SkillShape = Omit<CopilotSkill, "id" | "created_at" | "updated_at" | "chat_id" | "last_run_at">;

const PARTNER_BOUNDARY = "Partners only. It can read, draft, and deliver to the partners. It does not message a guest, a client, a building, or any other third party, and it does not purchase anything.";

function node(id: string, fn: FnName, note: string, field: string, y: number): WfNode {
  return { id, fn, note, field, x: 0, y };
}

function chain(name: string, boundary: string, steps: WfNode[]): Workflow {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "skill",
    name,
    boundary,
    memory: "Nothing yet",
    on: false,
    nodes: steps,
    edges: steps.slice(1).map((step, index) => ({ id: `e${index + 1}`, from: steps[index].id, to: step.id })),
  };
}

export function describedJob(text: string): boolean {
  return /\b(every|each)\b/i.test(text) && /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|morning|day|daily)\b/i.test(text);
}

/** The same skill the builder saves, created from a sentence. New skills stay off. */
export function skillFromWords(sentence: string): SkillShape {
  const text = sentence.trim();
  const shaped = normalizeSchedule("", text);
  const phone = text.match(/(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/)?.[0]?.trim() ?? "";
  const product = /\bpdf\b/i.test(text) || /\bproduct\b/i.test(text);
  const checkins = /check-?in|phone number|guest name/i.test(text);
  const name = (text || "New skill").slice(0, 80);
  const named = namedWeekday(text);
  const whenField = shaped.schedule.startsWith("weekly:")
    ? (named ? `${named} morning` : "Each week")
    : shaped.schedule === "daily"
      ? "Each morning"
      : "When you ask";
  const whenNode = node("n1", "When", shaped.when_text || schedulePhrase(shaped.schedule), whenField, 0);
  const steps: WfNode[] = [whenNode];
  if (product) {
    steps.push(node("n2", "Look on the web", "Find one product we can give guests", "A page about a guest gift", 220));
    steps.push(node("n3", "Write", "Email me a PDF of that one product", "Short and plain", 440));
  } else if (checkins) {
    steps.push(node("n2", "Read", "Guest names and phone numbers for the week's check-ins", "Hospitable", 220));
    steps.push(node("n3", "Text me", "Text me the list", phone, 440));
  } else {
    steps.push(node("n2", "Read", text.slice(0, 180) || "What the partners described", "Hospitable", 220));
    steps.push(node("n3", "Write", "Leave the result for the partners", "Short and plain", 440));
  }
  const boundary = product
    ? "Partners only. It may look up one product and email the partners a PDF. It does not buy anything, and it does not email a guest."
    : checkins
      ? "Partners only. It may read stays and text the partners the list. It does not text a guest, and it does not purchase anything."
      : PARTNER_BOUNDARY;
  const workflow = chain(name, boundary, steps);
  const skill = skillFromWorkflow({ ...workflow, on: false });
  return {
    ...skill,
    name,
    when_text: shaped.when_text || skill.when_text,
    schedule: shaped.schedule || skill.schedule,
    phone: phone || skill.phone,
    enabled: false,
    reads: checkins ? "Guest names and phone numbers for the week's check-ins" : skill.reads,
    drafts: product ? "Email me a PDF" : /\btext me\b/i.test(text) ? "Text me the list" : skill.drafts,
  };
}

/**
 * A new board is not a skill until this runs. No steps means nothing is created.
 * The first save stays off. The When step takes the schedule the partner picked.
 */
export function applyBuilderSave(wf: Workflow, name: string, schedule: SkillSchedule, first: boolean): Workflow | null {
  const title = name.trim();
  if (!title || !wf.nodes.length) return null;
  if (!scheduleChoices().some((choice) => choice.schedule === schedule)) return null;
  const phrase = schedulePhrase(schedule);
  const when = wf.nodes.find((step) => step.fn === "When");
  const nodes = wf.nodes.map((step) => {
    if (step.fn !== "When") return step;
    const stock = !step.note.trim() || step.note === FN.When.defaultNote || /8:00 each morning/i.test(`${step.field} ${step.note}`);
    return { ...step, field: phrase, note: stock ? phrase : step.note };
  });
  let nextNodes = nodes;
  let nextEdges = wf.edges;
  if (!when) {
    const id = "when";
    const firstNode = wf.nodes[0];
    nextNodes = [{ id, fn: "When", note: phrase, field: phrase, x: firstNode?.x ?? 0, y: (firstNode?.y ?? 220) - 220 }, ...nodes];
    if (firstNode) nextEdges = [{ id: "e-when", from: id, to: firstNode.id }, ...wf.edges];
  }
  const id = !wf.id || wf.id === "new"
    ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workflow"
    : wf.id;
  return { ...wf, id, name: title.slice(0, 120), on: first ? false : wf.on, nodes: nextNodes, edges: nextEdges };
}

/**
 * Builder graph to the skill the runner schedules.
 * A canvas time of 8:00 is the existing 5:00 Toronto morning pass.
 * Text me is partner delivery on this playbook. Wait for you stays an approval hold.
 */
export function skillFromWorkflow(wf: Workflow): SkillShape {
  const whenNode = wf.nodes.find((step) => step.fn === "When");
  const field = whenNode?.field ?? "";
  const unnamedWeek = /\b(every|each)\s+week\b/i.test(field) && !namedWeekday(field);
  const shaped = unnamedWeek
    ? { schedule: "weekly:Monday" as const, when_text: "Every week. No weekday was named, so this runs Monday morning on the 5:00 pass." }
    : normalizeSchedule("", `${field} ${whenNode?.note ?? ""}`);
  let when_text = shaped.when_text || field.trim() || "When you ask in chat";
  if (!unnamedWeek && shaped.schedule === "daily") when_text = /8:00/.test(field) ? "Every morning on the 5:00 Toronto pass." : "Every morning, ~5:00";
  if (!unnamedWeek && shaped.schedule.startsWith("weekly:")) when_text = `Every ${shaped.schedule.slice("weekly:".length)} morning, ~5:00`;
  const reads = wf.nodes
    .filter((step) => step.fn === "Read" || step.fn === "Look on the web")
    .map((step) => step.note.trim())
    .filter(Boolean)
    .join(" ");
  const drafts = wf.nodes
    .filter((step) => step.fn === "Write" || step.fn === "Text me")
    .map((step) => step.note.trim())
    .filter(Boolean)
    .join(" ");
  const phone = wf.nodes.find((step) => step.fn === "Text me")?.field.trim() ?? "";
  const hold = "Anything for a guest, a client, a building, or any third party waits until a partner presses Submit. Do not purchase anything.";
  const boundary = wf.boundary.trim();
  return {
    name: (wf.name || "New workflow").slice(0, 120),
    when_text,
    reads: reads || "Hospitable",
    drafts: drafts || "A report for the partners",
    must_not: [boundary, hold].filter(Boolean).join(" "),
    enabled: wf.on,
    kind: "playbook",
    phone,
    schedule: shaped.schedule,
    workflow: { ...wf, on: wf.on, boundary },
  };
}

export function workflowFromSkill(skill: CopilotSkill): Workflow {
  if (skill.workflow && Array.isArray(skill.workflow.nodes)) {
    return { ...skill.workflow, name: skill.name, on: skill.enabled, boundary: skill.workflow.boundary || skill.must_not };
  }
  const rebuilt = skillFromWords(`${skill.when_text}. ${skill.name}. ${skill.reads}. ${skill.drafts}`);
  return { ...(rebuilt.workflow as Workflow), name: skill.name, on: skill.enabled };
}

export function draftFromSkill(skill: SkillShape, sentence: string): CopilotDraft {
  return {
    channel: "skill",
    status: "waiting",
    subject: skill.name,
    body: sentence.trim(),
    to: "",
    skillName: skill.name,
    skillWhen: skill.when_text,
    skillReads: skill.reads,
    skillDrafts: skill.drafts,
    skillMustNot: skill.must_not,
    skillKind: "playbook",
    skillPhone: skill.phone,
    skillSchedule: skill.schedule,
  };
}
