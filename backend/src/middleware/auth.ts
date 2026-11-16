import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import type { AppEnv } from "../types";

export async function authenticate(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required." }, 401);
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, c.env.JWT_SECRET) as { sub: string };
    c.set("consultantId", payload.sub);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired session. Please sign in again." }, 401);
  }
}
