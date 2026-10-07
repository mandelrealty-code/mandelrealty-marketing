/**
 * Sends an awaiting contract the same way OPS Send Contract does:
 * store the awaiting PDF, then email the client the revised portal link.
 */

import { assignAwaitingContract, type PmContract } from "./contractStore.js";
import type { SignField } from "./signFields.js";
import { sendOwnerInviteEmail } from "../ownerEmails.js";

export async function deliverAwaitingContract(input: {
  clientId: string;
  propertyId?: string | null;
  title: string;
  filename: string;
  mime: string;
  buffer: Buffer;
  sourceBuffer?: Buffer;
  templateId?: string | null;
  signFields?: SignField[];
  email: string;
  firstName: string;
  propertyLabel?: string;
  slug: string;
  tempPassword?: string;
  kind: "new" | "existing" | "revised";
}): Promise<{ contract: PmContract; emailOk: boolean; emailError: string | null }> {
  const contract = await assignAwaitingContract({
    client_id: input.clientId,
    property_id: input.propertyId || null,
    title: input.title,
    filename: input.filename,
    mime: input.mime,
    buffer: input.buffer,
    template_id: input.templateId || null,
    sign_fields: input.signFields,
    sourceBuffer: input.sourceBuffer,
  });
  const mail = await sendOwnerInviteEmail({
    to: input.email,
    firstName: input.firstName,
    propertyLabel: input.propertyLabel,
    slug: input.slug,
    tempPassword: input.tempPassword,
    kind: input.kind,
  });
  return { contract, emailOk: mail.ok, emailError: mail.ok ? null : mail.message || "Email failed" };
}
