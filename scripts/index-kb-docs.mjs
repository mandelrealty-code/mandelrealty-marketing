/**
 * Index CRM knowledge markdown files into Supabase knowledge_docs.
 * Usage: node --env-file=.env.local scripts/index-kb-docs.mjs
 * Or: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... node scripts/index-kb-docs.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const { uploadAndIndexKnowledgeText } = await import("../shared/knowledgeStore.js");

  const docs = [
    {
      title: "MRG Growth Partnership Agreement",
      path: resolve(root, "docs/knowledge/mrg-growth-partnership.md"),
    },
    {
      title: "MRG Managed Essentials Fixed-Rate Agreement",
      path: resolve(root, "docs/knowledge/mrg-managed-essentials.md"),
    },
  ];

  for (const d of docs) {
    const text = readFileSync(d.path, "utf8");
    console.log(`Indexing: ${d.title} (${text.length} chars)…`);
    const doc = await uploadAndIndexKnowledgeText({ title: d.title, text });
    if (!doc) {
      console.error(`FAILED: ${d.title}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`OK: ${doc.id} status=${doc.status} chunks=${doc.chunk_count}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
