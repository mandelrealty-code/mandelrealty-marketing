import type { VercelRequest, VercelResponse } from "@vercel/node";
import handleTeam from "../shared/teamApi.js";

/** Public employee / VA portal API — never under admin host. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleTeam(req, res);
}
