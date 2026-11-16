import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AppEnv } from "../types";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";

const app = new Hono<AppEnv>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function signToken(consultantId: string, rememberMe: boolean, secret: string, defaultExpiresIn: string) {
  const expiresIn = (rememberMe ? "30d" : defaultExpiresIn) as jwt.SignOptions["expiresIn"];
  return jwt.sign({ sub: consultantId }, secret, { expiresIn });
}

function sanitizeConsultant(c: any) {
  const { passwordHash, ...rest } = c;
  return rest;
}

// First-run setup: only works while no consultant account exists yet.
app.post("/setup", async (c) => {
  const prisma = c.get("prisma");
  const schema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    defaultLanguage: z.enum(["en", "he", "ar"]).optional(),
  });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  }
  const existing = await prisma.consultant.count();
  if (existing > 0) {
    return c.json({ error: "Setup has already been completed. Please sign in." }, 403);
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const consultant = await prisma.consultant.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      ...(parsed.data.defaultLanguage ? { defaultLanguage: parsed.data.defaultLanguage } : {}),
    },
  });
  await recordAudit(prisma, { consultantId: consultant.id, action: "ACCOUNT_SETUP", entityType: "Consultant", entityId: consultant.id });
  const token = signToken(consultant.id, false, c.env.JWT_SECRET, c.env.JWT_EXPIRES_IN);
  return c.json({ token, consultant: sanitizeConsultant(consultant) }, 201);
});

app.get("/setup/status", async (c) => {
  const prisma = c.get("prisma");
  const existing = await prisma.consultant.count();
  return c.json({ needsSetup: existing === 0 });
});

app.post("/login", async (c) => {
  const prisma = c.get("prisma");
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional(),
  });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Please enter a valid email and password." }, 400);
  }
  const { email, password, rememberMe } = parsed.data;
  const consultant = await prisma.consultant.findUnique({ where: { email: email.toLowerCase() } });

  const ip = c.req.header("CF-Connecting-IP") ?? null;
  if (!consultant || !consultant.isActive) {
    await recordAudit(prisma, { consultantId: null, action: "SIGN_IN_FAILED", entityType: "Consultant", details: `email=${email}`, ipAddress: ip });
    return c.json({ error: "Invalid email or password." }, 401);
  }

  if (consultant.lockedUntil && consultant.lockedUntil > new Date()) {
    const minutes = Math.ceil((consultant.lockedUntil.getTime() - Date.now()) / 60000);
    return c.json({ error: `Too many failed attempts. Try again in ${minutes} minute(s).` }, 423);
  }

  const valid = await bcrypt.compare(password, consultant.passwordHash);
  if (!valid) {
    const attempts = consultant.failedLoginAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await prisma.consultant.update({
      where: { id: consultant.id },
      data: { failedLoginAttempts: lockedUntil ? 0 : attempts, lockedUntil },
    });
    await recordAudit(prisma, { consultantId: consultant.id, action: "SIGN_IN_FAILED", entityType: "Consultant", entityId: consultant.id, ipAddress: ip });
    return c.json({ error: "Invalid email or password." }, 401);
  }

  await prisma.consultant.update({
    where: { id: consultant.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  await recordAudit(prisma, { consultantId: consultant.id, action: "SIGN_IN_SUCCESS", entityType: "Consultant", entityId: consultant.id, ipAddress: ip });

  const token = signToken(consultant.id, !!rememberMe, c.env.JWT_SECRET, c.env.JWT_EXPIRES_IN);
  return c.json({ token, consultant: sanitizeConsultant(consultant) });
});

app.post("/logout", authenticate, async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  await recordAudit(prisma, { consultantId, action: "SIGN_OUT", entityType: "Consultant", entityId: consultantId });
  return c.json({ ok: true });
});

app.get("/me", authenticate, async (c) => {
  const prisma = c.get("prisma");
  const consultant = await prisma.consultant.findUnique({ where: { id: c.get("consultantId")! } });
  if (!consultant) return c.json({ error: "Account not found." }, 404);
  return c.json({ consultant: sanitizeConsultant(consultant) });
});

app.post("/forgot-password", async (c) => {
  const prisma = c.get("prisma");
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please enter a valid email address." }, 400);

  const consultant = await prisma.consultant.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Always return a generic response to avoid revealing which emails exist.
  const genericResponse = { ok: true, message: "If an account exists for that email, password reset instructions have been generated." };

  if (!consultant) return c.json(genericResponse);

  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordReset.create({ data: { token, consultantId: consultant.id, expiresAt } });
  await recordAudit(prisma, { consultantId: consultant.id, action: "PASSWORD_RESET_REQUESTED", entityType: "Consultant", entityId: consultant.id });

  // No email provider is configured yet. The token is always logged server-side
  // so a reset can be completed by checking the server logs; it is only ever
  // included in the API response outside production, to exercise the flow
  // end-to-end locally without leaking reset tokens to anyone who can reach
  // this endpoint in a real deployment.
  console.log(`[password-reset] token for ${consultant.email}: ${token}`);
  const devFields = c.env.ENVIRONMENT === "production" ? {} : { devResetToken: token };
  return c.json({ ...genericResponse, ...devFields });
});

app.post("/reset-password", async (c) => {
  const prisma = c.get("prisma");
  const schema = z.object({ token: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Password must be at least 8 characters." }, 400);

  const reset = await prisma.passwordReset.findUnique({ where: { token: parsed.data.token } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return c.json({ error: "This reset link is invalid or has expired." }, 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.$transaction([
    prisma.consultant.update({ where: { id: reset.consultantId }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
  await recordAudit(prisma, { consultantId: reset.consultantId, action: "PASSWORD_RESET_COMPLETED", entityType: "Consultant", entityId: reset.consultantId });
  return c.json({ ok: true });
});

app.post("/change-password", authenticate, async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "New password must be at least 8 characters." }, 400);

  const consultant = await prisma.consultant.findUnique({ where: { id: consultantId } });
  if (!consultant) return c.json({ error: "Account not found." }, 404);

  const valid = await bcrypt.compare(parsed.data.currentPassword, consultant.passwordHash);
  if (!valid) return c.json({ error: "Current password is incorrect." }, 401);

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.consultant.update({ where: { id: consultant.id }, data: { passwordHash } });
  await recordAudit(prisma, { consultantId: consultant.id, action: "PASSWORD_CHANGED", entityType: "Consultant", entityId: consultant.id });
  return c.json({ ok: true });
});

export default app;
