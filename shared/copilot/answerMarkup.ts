/**
 * Chat answers are markdown. The partner sees emphasis, lists, and links,
 * never the asterisks or other markup characters.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline code is set apart first, so nothing inside it is read as emphasis or a link. */
function inline(raw: string): string {
  return raw.split(/(`[^`\n]+`)/).map((part, index) => (index % 2 ? `<code>${escapeHtml(part.slice(1, -1))}</code>` : inlineText(part))).join("");
}

function inlineText(raw: string): string {
  let text = escapeHtml(raw);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  text = text.replace(/(?<!href=")https?:\/\/[^\s<]+/g, (rawUrl) => {
    const url = rawUrl.replace(/[),.;]+$/, "");
    const tail = rawUrl.slice(url.length);
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${tail}`;
  });
  return text.replace(/\*\*/g, "").replace(/__/g, "");
}

function marker(line: string): { ordered: boolean; rest: string } | null {
  const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
  if (bullet?.[1]) return { ordered: false, rest: bullet[1] };
  const numbered = /^\s*\d+\.\s+(.+)$/.exec(line);
  if (numbered?.[1]) return { ordered: true, rest: numbered[1] };
  return null;
}

const FENCE = /^\s*```/;
const HEADING = /^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/;
const QUOTE = /^\s*>/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/**
 * An answer cut into blocks at its blank lines (never inside a code fence). While an answer streams, every finished block
 * stays exactly as it was and only the last one grows, so nothing already on screen is redrawn or repeated.
 */
export function splitAnswerBlocks(source: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let fenced = false;
  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    if (FENCE.test(line)) fenced = !fenced;
    if (!fenced && !line.trim() && !FENCE.test(line)) {
      if (current.length) blocks.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join("\n"));
  return blocks;
}

/** HTML for one answer or summary. Markup characters are not left in the text. */
export function renderAnswer(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;
  const startsBlock = (line: string) => FENCE.test(line) || HEADING.test(line) || QUOTE.test(line) || RULE.test(line) || Boolean(marker(line));
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim() || RULE.test(line)) {
      index += 1;
      continue;
    }
    if (FENCE.test(line)) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push(`<${tag}>${inline(heading[2]!)}</${tag}>`);
      index += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] ?? "")) {
        quoted.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote>${renderAnswer(quoted.join("\n"))}</blockquote>`);
      continue;
    }
    const first = marker(line);
    if (first) {
      const ordered = first.ordered;
      const items: string[] = [];
      while (index < lines.length) {
        const item = marker(lines[index] ?? "");
        if (!item || item.ordered !== ordered) break;
        items.push(`<li>${inline(item.rest)}</li>`);
        index += 1;
      }
      blocks.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index]?.trim() && !startsBlock(lines[index] ?? "")) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(`<p>${paragraph.map((row) => inline(row)).join("<br>")}</p>`);
  }
  return blocks.join("");
}
