import { sendResendEmail } from "./auditEmails.js";
import { staffPortalInviteEmail, taskAssignedEmail } from "./emailTemplates.js";
import { publicSiteOrigin } from "./ownerEmails.js";

export function teamPortalUrl(slug: string, path = ""): string {
  const clean = slug.trim().toLowerCase();
  const suffix = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${publicSiteOrigin()}/team/${clean}${suffix}`;
}

export async function sendStaffInviteEmail(input: {
  to: string;
  firstName: string;
  slug: string;
  tempPassword: string;
  displayName?: string;
  role?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not configured." };
  const from =
    process.env.RESEND_FROM?.trim() ||
    "Mandel Realty Group <info@mandelrealtygroup.com>";
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com";
  const portal = teamPortalUrl(input.slug);
  const code = input.tempPassword.trim();
  if (!code) return { ok: false, message: "tempPassword required." };
  const portalWithCode = `${portal}?code=${encodeURIComponent(code)}`;

  const html = staffPortalInviteEmail({
    firstName: input.firstName,
    role: input.role?.trim() || "Team member",
    email: input.to,
    inviteUrl: portalWithCode,
  });

  const roleLabel = input.role?.trim() || "Team member";
  const text = [
    `Welcome to the MRG team, ${input.firstName}`,
    "",
    "This is your MRG team portal to view your tasks and log your hours.",
    "",
    `Role: ${roleLabel}`,
    `Email: ${input.to}`,
    "",
    "Your temporary sign-in code:",
    "",
    `    ${code}`,
    "",
    `Portal: ${portal}`,
    "",
    `Open portal (code ready): ${portalWithCode}`,
    "",
    "Questions? Contact Shane.",
    "— Mandel Realty Group",
  ].join("\n");

  return sendResendEmail({
    apiKey,
    from,
    to: [input.to],
    subject: "Your MRG team portal invite",
    html,
    text,
    replyTo,
    headers: {
      "List-Unsubscribe": `<mailto:${replyTo}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

export type AssignedTask = { label: string; due: string };

/** Tells an employee which onboarding tasks were given to them, for one unit, with their due dates. */
export async function sendTaskAssignedEmail(input: {
  to: string;
  firstName: string;
  slug: string;
  unit: string;
  tasks: AssignedTask[];
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  if (!apiKey) return { ok: false, message: "RESEND_API_KEY not configured." };
  const from = process.env.RESEND_FROM?.trim() || "Mandel Realty Group <info@mandelrealtygroup.com>";
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || "info@mandelrealtygroup.com";
  const portal = teamPortalUrl(input.slug);
  const many = input.tasks.length > 1;
  const subject = many ? `${input.tasks.length} tasks for you: ${input.unit}` : `A task for you: ${input.unit}`;
  const primary = input.tasks[0];
  const taskType = many
    ? input.tasks.map((t) => t.label).join(", ")
    : primary?.label || "Task";
  const date = primary?.due
    ? many
      ? `Due ${primary.due}${input.tasks.length > 1 ? ` (+${input.tasks.length - 1} more)` : ""}`
      : primary.due
    : "—";
  const html = taskAssignedEmail({
    firstName: input.firstName,
    propertyName: input.unit,
    taskType,
    date,
    assignedBy: "MRG",
    portalUrl: portal,
  });
  const text = [
    `Hi ${input.firstName},`,
    "",
    `You have been given ${many ? "these tasks" : "this task"} for ${input.unit}:`,
    ...input.tasks.map((t) => `- ${t.label}${t.due ? " (due " + t.due + ")" : ""}`),
    "",
    `Team portal: ${portal}`,
    `Questions? Reply to this email (${replyTo}).`,
    "— Mandel Realty Group",
  ].join("\n");
  return sendResendEmail({ apiKey, from, to: [input.to], subject, html, text, replyTo });
}
