import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET as string;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

function signToken(consultantId: string, rememberMe: boolean) {
  const expiresIn = (rememberMe ? "30d" : process.env.JWT_EXPIRES_IN || "8h") as jwt.SignOptions["expiresIn"];
  return jwt.sign({ sub: consultantId }, JWT_SECRET, { expiresIn });
}

function sanitizeConsultant(c: any) {
  const { passwordHash, ...rest } = c;
  return rest;
}

// First-run setup: only works while no consultant account exists yet.
router.post("/setup", async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  }
  const existing = await prisma.consultant.count();
  if (existing > 0) {
    return res.status(403).json({ error: "Setup has already been completed. Please sign in." });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const consultant = await prisma.consultant.create({
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
    },
  });
  await recordAudit({ consultantId: consultant.id, action: "ACCOUNT_SETUP", entityType: "Consultant", entityId: consultant.id });
  const token = signToken(consultant.id, false);
  res.status(201).json({ token, consultant: sanitizeConsultant(consultant) });
});

router.get("/setup/status", async (_req, res) => {
  const existing = await prisma.consultant.count();
  res.json({ needsSetup: existing === 0 });
});

router.post("/login", loginLimiter, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    rememberMe: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please enter a valid email and password." });
  }
  const { email, password, rememberMe } = parsed.data;
  const consultant = await prisma.consultant.findUnique({ where: { email: email.toLowerCase() } });

  const ip = req.ip;
  if (!consultant || !consultant.isActive) {
    await recordAudit({ consultantId: null, action: "SIGN_IN_FAILED", entityType: "Consultant", details: `email=${email}`, ipAddress: ip });
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (consultant.lockedUntil && consultant.lockedUntil > new Date()) {
    const minutes = Math.ceil((consultant.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({ error: `Too many failed attempts. Try again in ${minutes} minute(s).` });
  }

  const valid = await bcrypt.compare(password, consultant.passwordHash);
  if (!valid) {
    const attempts = consultant.failedLoginAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
    await prisma.consultant.update({
      where: { id: consultant.id },
      data: { failedLoginAttempts: lockedUntil ? 0 : attempts, lockedUntil },
    });
    await recordAudit({ consultantId: consultant.id, action: "SIGN_IN_FAILED", entityType: "Consultant", entityId: consultant.id, ipAddress: ip });
    return res.status(401).json({ error: "Invalid email or password." });
  }

  await prisma.consultant.update({
    where: { id: consultant.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  await recordAudit({ consultantId: consultant.id, action: "SIGN_IN_SUCCESS", entityType: "Consultant", entityId: consultant.id, ipAddress: ip });

  const token = signToken(consultant.id, !!rememberMe);
  res.json({ token, consultant: sanitizeConsultant(consultant) });
});

router.post("/logout", authenticate, async (req: AuthedRequest, res) => {
  await recordAudit({ consultantId: req.consultantId!, action: "SIGN_OUT", entityType: "Consultant", entityId: req.consultantId });
  res.json({ ok: true });
});

router.get("/me", authenticate, async (req: AuthedRequest, res) => {
  const consultant = await prisma.consultant.findUnique({ where: { id: req.consultantId! } });
  if (!consultant) return res.status(404).json({ error: "Account not found." });
  res.json({ consultant: sanitizeConsultant(consultant) });
});

router.post("/forgot-password", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please enter a valid email address." });

  const consultant = await prisma.consultant.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Always return a generic response to avoid revealing which emails exist.
  const genericResponse = { ok: true, message: "If an account exists for that email, password reset instructions have been generated." };

  if (!consultant) return res.json(genericResponse);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordReset.create({ data: { token, consultantId: consultant.id, expiresAt } });
  await recordAudit({ consultantId: consultant.id, action: "PASSWORD_RESET_REQUESTED", entityType: "Consultant", entityId: consultant.id });

  // No email provider is configured in this MVP; the reset link is returned
  // directly (and logged) so the flow can be exercised end-to-end.
  console.log(`[password-reset] token for ${consultant.email}: ${token}`);
  res.json({ ...genericResponse, devResetToken: token });
});

router.post("/reset-password", async (req, res) => {
  const schema = z.object({ token: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Password must be at least 8 characters." });

  const reset = await prisma.passwordReset.findUnique({ where: { token: parsed.data.token } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.$transaction([
    prisma.consultant.update({ where: { id: reset.consultantId }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
  await recordAudit({ consultantId: reset.consultantId, action: "PASSWORD_RESET_COMPLETED", entityType: "Consultant", entityId: reset.consultantId });
  res.json({ ok: true });
});

router.post("/change-password", authenticate, async (req: AuthedRequest, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "New password must be at least 8 characters." });

  const consultant = await prisma.consultant.findUnique({ where: { id: req.consultantId! } });
  if (!consultant) return res.status(404).json({ error: "Account not found." });

  const valid = await bcrypt.compare(parsed.data.currentPassword, consultant.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect." });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.consultant.update({ where: { id: consultant.id }, data: { passwordHash } });
  await recordAudit({ consultantId: consultant.id, action: "PASSWORD_CHANGED", entityType: "Consultant", entityId: consultant.id });
  res.json({ ok: true });
});

export default router;
