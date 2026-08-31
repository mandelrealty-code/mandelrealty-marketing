import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSopBySlug, listSops } from "./pm/sopStore.js";

export default async function handlePublicSop(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const slug = typeof req.query.slug === "string" ? req.query.slug.trim() : "";
    if (slug) {
      const sop = await getSopBySlug(slug);
      if (!sop || !sop.is_published) {
        return res.status(404).json({ error: "SOP not found" });
      }
      return res.status(200).json({ sop });
    }

    const category = typeof req.query.category === "string" ? req.query.category.trim() : undefined;
    const sops = await listSops({ category, onlyPublished: true });
    return res.status(200).json({ sops });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load SOP" });
  }
}
