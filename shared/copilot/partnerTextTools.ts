/** The agent's texting tools. Chat and saved skills use the same safe sender; nothing here can text a guest. */

import type { AgentTool } from "./agentLoop.js";
import { addMessage } from "./store.js";
import { asksForText, recentTexts, sendPartnerText } from "./partnerText.js";
import type { CopilotSkill } from "./types.js";

const SKILL_TEXT = /\btext\b|\bsms\b/i;

/**
 * partnerText is set in a chat: the partner's own words must ask for a text. skill is set in a saved skill or workflow run:
 * a "Text me" step (forced) or a skill whose own words say it texts. defaultTo is the number a Text me step carries.
 */
export function sendTextTool(opts: { partnerText?: string; skill?: CopilotSkill; forced?: boolean; defaultTo?: string }): AgentTool {
  return {
    name: "send_text",
    description: "Texts a partner's own phone through Twilio. It only ever texts the partners' numbers on file in Settings: any other number is refused. Use it only when the partner asked for a text (\"text me\", \"send me the total\") or when a saved skill or workflow step says to text. Never use it unprompted. Pass body (short and plain; under 300 characters is best). Leave to out to use the partner's number, or pass one of their numbers. Quiet hours are 10 PM to 8 AM Toronto: a text a saved skill sends on its own then waits as a message in the app, unless urgent is true, which is only for something that cannot wait until morning. It cannot text a guest, a client or anyone else. The result says plainly whether it was texted.",
    input_schema: { type: "object", properties: { body: { type: "string" }, to: { type: "string" }, urgent: { type: "boolean" } }, required: ["body"] },
    run: async (input) => {
      const body = String(input.body ?? "");
      const inChat = opts.partnerText !== undefined;
      if (inChat && !asksForText(opts.partnerText ?? "")) {
        return { sent: false, reason: "not-asked", note: "The partner didn't ask for a text, so nothing was texted. I only text when asked." };
      }
      if (!inChat && !opts.forced && !(opts.skill && SKILL_TEXT.test(`${opts.skill.name} ${opts.skill.when_text} ${opts.skill.reads} ${opts.skill.drafts}`))) {
        return { sent: false, reason: "not-asked", note: "This skill isn't set up to text anyone, so nothing was texted." };
      }
      const to = String(input.to ?? "").trim() || opts.defaultTo || "";
      const out = await sendPartnerText({ to, body, urgent: input.urgent === true, askedNow: inChat, skillId: opts.skill?.id });
      // A night hold is not a loss: the message waits in the skill's chat for the morning.
      if (!out.sent && out.reason === "quiet-hours" && opts.skill?.chat_id) {
        await addMessage({ chatId: opts.skill.chat_id, role: "assistant", body: `Held for the morning (quiet hours):\n${body.slice(0, 600)}` }).catch(() => undefined);
      }
      return out;
    },
  };
}

export function sentTextsTool(): AgentTool {
  return {
    name: "sent_texts",
    description: "What Copilot has texted to the partners lately, newest first: the number, when, and the first 100 characters. Use it when the partner asks what was texted. Read only.",
    input_schema: { type: "object", properties: {} },
    run: async () => ({ texts: await recentTexts(30) }),
  };
}
