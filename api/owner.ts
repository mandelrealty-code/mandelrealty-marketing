import type { VercelRequest, VercelResponse } from "@vercel/node";
import handleOwner from "../shared/ownerApi.js";

/** Public owner portal API — never under admin host. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleOwner(req, res);
}
