import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";
import { PRIORITIES, ACTION_ITEM_STATUSES } from "../utils/enums";

const router = Router();
router.use(authenticate);

const actionItemInput = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1),
  instructions: z.string().optional().nullable(),
  visitId: z.string().optional().nullable(),
  problemId: z.string().optional().nullable(),
  recommendationId: z.string().optional().nullable(),
  babyId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(ACTION_ITEM_STATUSES).optional(),
  notes: z.string().optional().nullable(),
});

function toDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/action-items?status=&overdue=true&clientId=
router.get("/", async (req: AuthedRequest, res) => {
  const { status, overdue, clientId } = req.query as Record<string, string | undefined>;
  const where: any = { client: { consultantId: req.consultantId } };
  if (clientId) where.clientId = clientId;
  if (status) where.status = status;
  if (overdue === "true") {
    where.status = { in: ["TODO", "IN_PROGRESS"] };
    where.dueDate = { lt: new Date() };
  }
  const actionItems = await prisma.actionItem.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: { client: { select: { id: true, fullName: true } }, baby: { select: { id: true, fullName: true } } },
  });
  res.json({ actionItems });
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = actionItemInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  const d = parsed.data;
  const client = await prisma.client.findFirst({ where: { id: d.clientId, consultantId: req.consultantId } });
  if (!client) return res.status(404).json({ error: "Client not found." });

  const actionItem = await prisma.actionItem.create({
    data: {
      clientId: client.id,
      title: d.title,
      instructions: d.instructions || null,
      visitId: d.visitId || null,
      problemId: d.problemId || null,
      recommendationId: d.recommendationId || null,
      babyId: d.babyId || null,
      dueDate: toDate(d.dueDate),
      priority: d.priority || "MEDIUM",
      status: d.status || "TODO",
      notes: d.notes || null,
    },
  });
  await recordAudit({ consultantId: req.consultantId!, action: "ACTION_ITEM_CREATED", entityType: "ActionItem", entityId: actionItem.id });
  res.status(201).json({ actionItem });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.actionItem.findFirst({ where: { id: req.params.id, client: { consultantId: req.consultantId } } });
  if (!existing) return res.status(404).json({ error: "Action item not found." });
  const parsed = actionItemInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields." });
  const d = parsed.data;

  const completedAt =
    d.status === "COMPLETED" && existing.status !== "COMPLETED"
      ? new Date()
      : d.status !== undefined && d.status !== "COMPLETED"
      ? null
      : undefined;

  const actionItem = await prisma.actionItem.update({
    where: { id: existing.id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.instructions !== undefined ? { instructions: d.instructions || null } : {}),
      ...(d.problemId !== undefined ? { problemId: d.problemId || null } : {}),
      ...(d.recommendationId !== undefined ? { recommendationId: d.recommendationId || null } : {}),
      ...(d.babyId !== undefined ? { babyId: d.babyId || null } : {}),
      ...(d.dueDate !== undefined ? { dueDate: toDate(d.dueDate) } : {}),
      ...(d.priority !== undefined ? { priority: d.priority } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
    },
  });
  await recordAudit({ consultantId: req.consultantId!, action: "ACTION_ITEM_UPDATED", entityType: "ActionItem", entityId: actionItem.id });
  res.json({ actionItem });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.actionItem.findFirst({ where: { id: req.params.id, client: { consultantId: req.consultantId } } });
  if (!existing) return res.status(404).json({ error: "Action item not found." });
  await prisma.actionItem.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;
