import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";
import { PRIORITIES, ACTION_ITEM_STATUSES } from "../utils/enums";

const app = new Hono<AppEnv>();
app.use(authenticate);

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
app.get("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const { status, overdue, clientId } = c.req.query();
  const where: any = { client: { consultantId } };
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
  return c.json({ actionItems });
});

app.post("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const parsed = actionItemInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;
  const client = await prisma.client.findFirst({ where: { id: d.clientId, consultantId } });
  if (!client) return c.json({ error: "Client not found." }, 404);

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
  await recordAudit(prisma, { consultantId, action: "ACTION_ITEM_CREATED", entityType: "ActionItem", entityId: actionItem.id });
  return c.json({ actionItem }, 201);
});

app.put("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.actionItem.findFirst({ where: { id: c.req.param("id"), client: { consultantId } } });
  if (!existing) return c.json({ error: "Action item not found." }, 404);
  const parsed = actionItemInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields." }, 400);
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
  await recordAudit(prisma, { consultantId, action: "ACTION_ITEM_UPDATED", entityType: "ActionItem", entityId: actionItem.id });
  return c.json({ actionItem });
});

app.delete("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.actionItem.findFirst({ where: { id: c.req.param("id"), client: { consultantId } } });
  if (!existing) return c.json({ error: "Action item not found." }, 404);
  await prisma.actionItem.delete({ where: { id: existing.id } });
  return c.json({ ok: true });
});

export default app;
