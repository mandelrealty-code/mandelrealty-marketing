/**
 * Finds Hospitable's automated messages (check-in instructions, reminders, review requests) in threads Copilot has
 * already read, so a partner can confirm which ones are automations before the grocery thread-gap check ignores them.
 *
 * Read-only, pure, and makes no Hospitable calls: it only groups host and system messages that repeat, nearly word for
 * word, across several different reservations. Nothing here is used to decide anything until a partner confirms the list.
 */

export type SampleMessage = { at: string; role: string; name: string; body: string };
export type SampleThread = { id: string; messages: SampleMessage[] };

export type AutomationGroup = {
  /** The shared opening, with names, numbers and links replaced. This is what a later match uses. */
  key: string;
  threads: number;
  messages: number;
  /** How Hospitable labelled the sender: system and automated are almost surely automations. */
  roles: Record<string, number>;
  /** Names shown as the sender, when there are any. */
  senders: string[];
  firstSeen: string;
  lastSeen: string;
  examples: string[];
};

/** A message reduced to what stays the same between guests: no names, numbers, times or links. */
export function templateKey(body: string): string {
  const text = body
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/https?:\/\/\S+|www\.\S+/g, " {link} ")
    .replace(/\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)?\b/g, " # ")
    .replace(/\b\d+\b/g, " # ")
    .replace(/^\s*(hi|hello|hey|dear|good (morning|afternoon|evening))[\s,!.:-]+[\p{L}'-]+/u, "$1 {name}")
    .replace(/[^\p{L}#{}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 90).trim();
}

/** Does this message start like a confirmed automation? */
export function matchesAutomation(body: string, confirmedKeys: string[]): boolean {
  const key = templateKey(body);
  return Boolean(key) && confirmedKeys.some((confirmed) => confirmed && (key === confirmed || key.startsWith(confirmed) || confirmed.startsWith(key) && key.length >= 40));
}

export function findAutomatedTemplates(
  threads: SampleThread[],
  options: { minThreads?: number; maxGroups?: number } = {},
): { scanned: { threads: number; messages: number; hostOrSystem: number }; groups: AutomationGroup[] } {
  const min = Math.max(2, options.minThreads ?? 3);
  const groups = new Map<string, { threads: Set<string>; messages: number; roles: Record<string, number>; senders: Set<string>; first: string; last: string; examples: string[] }>();
  let messages = 0;
  let hostOrSystem = 0;
  for (const thread of threads) {
    for (const message of thread.messages) {
      messages += 1;
      if (message.role === "guest" || !message.body.trim()) continue;
      hostOrSystem += 1;
      const key = templateKey(message.body);
      if (key.length < 12) continue;
      const group = groups.get(key) ?? { threads: new Set<string>(), messages: 0, roles: {}, senders: new Set<string>(), first: "", last: "", examples: [] };
      group.threads.add(thread.id);
      group.messages += 1;
      group.roles[message.role] = (group.roles[message.role] ?? 0) + 1;
      if (message.name.trim() && !/^unknown$/i.test(message.name.trim())) group.senders.add(message.name.trim());
      if (!group.first || message.at < group.first) group.first = message.at;
      if (!group.last || message.at > group.last) group.last = message.at;
      if (group.examples.length < 2 && !group.examples.includes(message.body)) group.examples.push(message.body.slice(0, 600));
      groups.set(key, group);
    }
  }
  const found: AutomationGroup[] = [...groups]
    .filter(([, group]) => group.threads.size >= min)
    .map(([key, group]) => ({
      key,
      threads: group.threads.size,
      messages: group.messages,
      roles: group.roles,
      senders: [...group.senders].slice(0, 6),
      firstSeen: group.first,
      lastSeen: group.last,
      examples: group.examples,
    }))
    .sort((a, b) => b.threads - a.threads || b.messages - a.messages)
    .slice(0, options.maxGroups ?? 40);
  return { scanned: { threads: threads.length, messages, hostOrSystem }, groups: found };
}
