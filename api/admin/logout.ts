import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearAdminSessionCookie,
  cookieShouldBeSecure,
} from "../../shared/adminAuth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader(
    "Set-Cookie",
    clearAdminSessionCookie({ secure: cookieShouldBeSecure(req) }),
  );
  return res.status(200).json({ ok: true });
}
