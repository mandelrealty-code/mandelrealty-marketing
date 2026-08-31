import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSopBySlug } from "./pm/sopStore.js";

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

      if (req.query.video === "1") {
        if (sop.video_url && sop.video_url.startsWith("http")) {
          return res.redirect(302, sop.video_url);
        }
        return res.status(404).json({ error: "Video not found for this SOP" });
      }

      return res.status(200).json({ sop });
    }

    // Public hub list is disabled: individual shareable links only provide access to that specific SOP
    return res.status(403).json({ error: "Direct SOP slug required" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load SOP" });
  }
}
