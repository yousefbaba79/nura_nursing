import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";
import { FOLLOW_UP_TYPES, FOLLOW_UP_STATUSES } from "../utils/enums";

const router = Router();
router.use(authenticate);

const followUpInput = z.object({
  clientId: z.string().min(1),
  babyId: z.string().optional().nullable(),
  visitId: z.string().optional().nullable(),
  scheduledAt: z.string().min(1),
  type: z.enum(FOLLOW_UP_TYPES).optional(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(FOLLOW_UP_STATUSES).optional(),
});

// GET /api/follow-ups?scope=today|upcoming|overdue|completed&clientId=
router.get("/", async (req: AuthedRequest, res) => {
  const { scope, clientId } = req.query as Record<string, string | undefined>;
  const where: any = { client: { consultantId: req.consultantId } };
  if (clientId) where.clientId = clientId;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  if (scope === "today") {
    where.scheduledAt = { gte: startOfToday, lt: endOfToday };
    where.status = "SCHEDULED";
  } else if (scope === "upcoming") {
    where.scheduledAt = { gte: endOfToday };
    where.status = "SCHEDULED";
  } else if (scope === "overdue") {
    where.scheduledAt = { lt: startOfToday };
    where.status = "SCHEDULED";
  } else if (scope === "completed") {
    where.status = "COMPLETED";
  }

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: { client: { select: { id: true, fullName: true, phone: true } }, baby: { select: { id: true, fullName: true } } },
  });
  res.json({ followUps });
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = followUpInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  const d = parsed.data;
  const client = await prisma.client.findFirst({ where: { id: d.clientId, consultantId: req.consultantId } });
  if (!client) return res.status(404).json({ error: "Client not found." });

  const followUp = await prisma.followUp.create({
    data: {
      clientId: client.id,
      babyId: d.babyId || null,
      visitId: d.visitId || null,
      scheduledAt: new Date(d.scheduledAt),
      type: d.type || "CALL",
      reason: d.reason || null,
      notes: d.notes || null,
      status: d.status || "SCHEDULED",
    },
  });
  await recordAudit({ consultantId: req.consultantId!, action: "FOLLOW_UP_CREATED", entityType: "FollowUp", entityId: followUp.id });
  res.status(201).json({ followUp });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.followUp.findFirst({ where: { id: req.params.id, client: { consultantId: req.consultantId } } });
  if (!existing) return res.status(404).json({ error: "Follow-up not found." });
  const parsed = followUpInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields." });
  const d = parsed.data;

  const followUp = await prisma.followUp.update({
    where: { id: existing.id },
    data: {
      ...(d.babyId !== undefined ? { babyId: d.babyId || null } : {}),
      ...(d.visitId !== undefined ? { visitId: d.visitId || null } : {}),
      ...(d.scheduledAt !== undefined ? { scheduledAt: new Date(d.scheduledAt) } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.reason !== undefined ? { reason: d.reason || null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
    },
  });
  await recordAudit({ consultantId: req.consultantId!, action: "FOLLOW_UP_UPDATED", entityType: "FollowUp", entityId: followUp.id });
  res.json({ followUp });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.followUp.findFirst({ where: { id: req.params.id, client: { consultantId: req.consultantId } } });
  if (!existing) return res.status(404).json({ error: "Follow-up not found." });
  await prisma.followUp.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;
