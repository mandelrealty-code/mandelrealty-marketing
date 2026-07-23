import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBookedStartIsos } from "../shared/bookingStore.js";

/** Public list of taken call start ISOs for the time picker */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");
  const booked = await getBookedStartIsos();
  return res.status(200).json({ booked });
}
