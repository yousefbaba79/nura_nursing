import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";
import { FOLLOW_UP_TYPES, FOLLOW_UP_STATUSES } from "../utils/enums";

const app = new Hono<AppEnv>();
app.use(authenticate);

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

// Period filter for the "completed" scope: this_month | last_month | this_year | last_year | custom
// (custom uses the from/to query params, as YYYY-MM-DD dates; "to" is inclusive of the whole day).
function periodRange(period: string | undefined, from: string | undefined, to: string | undefined, now: Date): { gte?: Date; lt?: Date } | null {
  if (period === "this_month") {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  if (period === "last_month") {
    return { gte: new Date(now.getFullYear(), now.getMonth() - 1, 1), lt: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  if (period === "this_year") {
    return { gte: new Date(now.getFullYear(), 0, 1), lt: new Date(now.getFullYear() + 1, 0, 1) };
  }
  if (period === "last_year") {
    return { gte: new Date(now.getFullYear() - 1, 0, 1), lt: new Date(now.getFullYear(), 0, 1) };
  }
  if (period === "custom") {
    const gte = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const lt = toDate && !isNaN(toDate.getTime()) ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000) : undefined;
    const range: { gte?: Date; lt?: Date } = {};
    if (gte && !isNaN(gte.getTime())) range.gte = gte;
    if (lt) range.lt = lt;
    return Object.keys(range).length ? range : null;
  }
  return null;
}

// GET /api/follow-ups?scope=today|upcoming|overdue|completed&clientId=&period=&from=&to=
app.get("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const { scope, clientId, period, from, to } = c.req.query();
  const where: any = { client: { consultantId } };
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
    const range = periodRange(period, from, to, now);
    if (range) where.scheduledAt = range;
  }

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: { client: { select: { id: true, fullName: true, phone: true } }, baby: { select: { id: true, fullName: true } } },
  });
  return c.json({ followUps });
});

app.post("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const parsed = followUpInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;
  const client = await prisma.client.findFirst({ where: { id: d.clientId, consultantId } });
  if (!client) return c.json({ error: "Client not found." }, 404);

  const followUp = await prisma.followUp.create({
    data: {
      clientId: client.id,
      babyId: d.babyId || null,
      visitId: d.visitId || null,
      scheduledAt: new Date(d.scheduledAt),
      type: d.type || "CLINIC_VISIT",
      reason: d.reason || null,
      notes: d.notes || null,
      status: d.status || "SCHEDULED",
    },
  });
  await recordAudit(prisma, { consultantId, action: "FOLLOW_UP_CREATED", entityType: "FollowUp", entityId: followUp.id });
  return c.json({ followUp }, 201);
});

app.put("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.followUp.findFirst({ where: { id: c.req.param("id"), client: { consultantId } } });
  if (!existing) return c.json({ error: "Follow-up not found." }, 404);
  const parsed = followUpInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields." }, 400);
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
  await recordAudit(prisma, { consultantId, action: "FOLLOW_UP_UPDATED", entityType: "FollowUp", entityId: followUp.id });
  return c.json({ followUp });
});

app.delete("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.followUp.findFirst({ where: { id: c.req.param("id"), client: { consultantId } } });
  if (!existing) return c.json({ error: "Follow-up not found." }, 404);
  await prisma.followUp.delete({ where: { id: existing.id } });
  return c.json({ ok: true });
});

export default app;
