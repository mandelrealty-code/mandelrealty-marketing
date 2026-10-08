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

function inline(raw: string): string {
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

/** HTML for one answer or summary. Markup characters are not left in the text. */
export function renderAnswer(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index]?.trim()) {
      index += 1;
      continue;
    }
    const first = marker(lines[index] ?? "");
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
    while (index < lines.length && lines[index]?.trim() && !marker(lines[index] ?? "")) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(`<p>${paragraph.map((line) => inline(line)).join("<br>")}</p>`);
  }
  return blocks.join("");
}
