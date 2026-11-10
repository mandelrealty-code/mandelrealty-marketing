/**
 * The one check on a rule or an instruction before it can be saved. The Settings page runs it as you type, and the server runs
 * it again on save, so a bad one is shown before saving and is never stored. No imports: it runs in the browser too.
 */

export type RuleVerdict = { ok: true } | { ok: false; why: string };

const SKIP_APPROVAL = /without (asking|approval|my approval|a partner)|no approval|skip(ping)? (the )?approval|auto[- ]?(send|post|approve|publish)|send (it |them )?automatically|post (it |them )?automatically/i;
const PENNY_PRICE = /change (a|the|any) price (itself|directly|on its own|alone)|set (a |the )?price (itself|directly|on its own)|update (the )?price (itself|directly|automatically)|change prices (itself|directly|automatically|on its own)/i;

/** A prompt left in as a rule: a question, or "Ask:". A rule is a plain sentence that says what to do or never do. */
export const looksLikeAPrompt = (text: string) => /^\s*ask\s*:/i.test(text) || /\?\s*$/.test(text.trim());

export function checkRule(text: string, agent: string): RuleVerdict {
  const t = text.trim();
  if (!t) return { ok: true };
  if (SKIP_APPROVAL.test(t)) return { ok: false, why: "This rule cannot be saved, it tries to skip approval. Nothing was saved. Send, post, price and money actions always need Approve." };
  if (agent === "penny" && PENNY_PRICE.test(t)) return { ok: false, why: "This rule cannot be saved, it lets Penny change a price. Nothing was saved. Penny only recommends." };
  if (/[—–]/.test(t)) return { ok: false, why: "This rule cannot be saved, it has an em dash. Nothing was saved. Use a full stop or a plain hyphen." };
  if (looksLikeAPrompt(t)) return { ok: false, why: "This is a question, not a rule. Nothing was saved. Write what it must always or never do, in one plain sentence." };
  return { ok: true };
}

export function checkAll(items: string[], agent: string): RuleVerdict {
  for (const i of items) {
    const v = checkRule(i, agent);
    if (!v.ok) return v;
  }
  return { ok: true };
}
