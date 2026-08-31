import type { VercelRequest, VercelResponse } from "@vercel/node";
import handlePublicSop from "../shared/publicSopApi.js";

/** Public SOP API for VA and team guides. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handlePublicSop(req, res);
}
