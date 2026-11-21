import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import type { Prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";
import { FEEDING_METHODS } from "../utils/enums";

const app = new Hono<AppEnv>();
app.use(authenticate);

const babyInput = z.object({
  fullName: z.string().min(1, "Baby's name is required."),
  dateOfBirth: z.string().optional().nullable(),
  sex: z.string().optional().nullable(),
  gestationalAgeWeeks: z.string().optional().nullable(),
  deliveryType: z.string().optional().nullable(),
  birthWeightGrams: z.number().optional().nullable(),
  currentWeightGrams: z.number().optional().nullable(),
  lengthCm: z.number().optional().nullable(),
  headCircumferenceCm: z.number().optional().nullable(),
  medicalConditions: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  feedingMethod: z.enum(FEEDING_METHODS).optional().nullable(),
  dailyFeedsCount: z.number().optional().nullable(),
  supplementationInfo: z.string().optional().nullable(),
  hospitalInfo: z.string().optional().nullable(),
  pediatricianName: z.string().optional().nullable(),
  pediatricianPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function toDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function assertClientOwnership(prisma: Prisma, clientId: string, consultantId: string) {
  return prisma.client.findFirst({ where: { id: clientId, consultantId } });
}

// GET /api/clients/:clientId/babies
app.get("/clients/:clientId/babies", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const clientId = c.req.param("clientId");
  const client = await assertClientOwnership(prisma, clientId, consultantId);
  if (!client) return c.json({ error: "Client not found." }, 404);
  const babies = await prisma.baby.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } });
  return c.json({ babies });
});

// POST /api/clients/:clientId/babies
app.post("/clients/:clientId/babies", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const clientId = c.req.param("clientId");
  const client = await assertClientOwnership(prisma, clientId, consultantId);
  if (!client) return c.json({ error: "Client not found." }, 404);

  const parsed = babyInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;

  const baby = await prisma.baby.create({
    data: {
      clientId: client.id,
      fullName: d.fullName,
      dateOfBirth: toDate(d.dateOfBirth),
      sex: d.sex || null,
      gestationalAgeWeeks: d.gestationalAgeWeeks || null,
      deliveryType: d.deliveryType || null,
      birthWeightGrams: d.birthWeightGrams ?? null,
      currentWeightGrams: d.currentWeightGrams ?? null,
      lengthCm: d.lengthCm ?? null,
      headCircumferenceCm: d.headCircumferenceCm ?? null,
      medicalConditions: d.medicalConditions || null,
      medications: d.medications || null,
      allergies: d.allergies || null,
      feedingMethod: d.feedingMethod || null,
      dailyFeedsCount: d.dailyFeedsCount ?? null,
      supplementationInfo: d.supplementationInfo || null,
      hospitalInfo: d.hospitalInfo || null,
      pediatricianName: d.pediatricianName || null,
      pediatricianPhone: d.pediatricianPhone || null,
      notes: d.notes || null,
    },
  });

  if (baby.currentWeightGrams) {
    await prisma.weightLog.create({ data: { babyId: baby.id, weightGrams: baby.currentWeightGrams, date: baby.dateOfBirth || new Date() } });
  }

  await recordAudit(prisma, { consultantId, action: "BABY_CREATED", entityType: "Baby", entityId: baby.id, details: `clientId=${client.id}` });
  return c.json({ baby }, 201);
});

// GET /api/babies/:id
app.get("/babies/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const baby = await prisma.baby.findFirst({
    where: { id, client: { consultantId } },
    include: {
      weightLogs: { orderBy: { date: "asc" } },
    },
  });
  if (!baby) return c.json({ error: "Baby not found." }, 404);
  return c.json({ baby });
});

// PUT /api/babies/:id
app.put("/babies/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const existing = await prisma.baby.findFirst({ where: { id, client: { consultantId } } });
  if (!existing) return c.json({ error: "Baby not found." }, 404);

  const parsed = babyInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;

  const baby = await prisma.baby.update({
    where: { id: existing.id },
    data: {
      ...(d.fullName !== undefined ? { fullName: d.fullName } : {}),
      ...(d.dateOfBirth !== undefined ? { dateOfBirth: toDate(d.dateOfBirth) } : {}),
      ...(d.sex !== undefined ? { sex: d.sex || null } : {}),
      ...(d.gestationalAgeWeeks !== undefined ? { gestationalAgeWeeks: d.gestationalAgeWeeks || null } : {}),
      ...(d.deliveryType !== undefined ? { deliveryType: d.deliveryType || null } : {}),
      ...(d.birthWeightGrams !== undefined ? { birthWeightGrams: d.birthWeightGrams } : {}),
      ...(d.currentWeightGrams !== undefined ? { currentWeightGrams: d.currentWeightGrams } : {}),
      ...(d.lengthCm !== undefined ? { lengthCm: d.lengthCm } : {}),
      ...(d.headCircumferenceCm !== undefined ? { headCircumferenceCm: d.headCircumferenceCm } : {}),
      ...(d.medicalConditions !== undefined ? { medicalConditions: d.medicalConditions || null } : {}),
      ...(d.medications !== undefined ? { medications: d.medications || null } : {}),
      ...(d.allergies !== undefined ? { allergies: d.allergies || null } : {}),
      ...(d.feedingMethod !== undefined ? { feedingMethod: d.feedingMethod || null } : {}),
      ...(d.dailyFeedsCount !== undefined ? { dailyFeedsCount: d.dailyFeedsCount } : {}),
      ...(d.supplementationInfo !== undefined ? { supplementationInfo: d.supplementationInfo || null } : {}),
      ...(d.hospitalInfo !== undefined ? { hospitalInfo: d.hospitalInfo || null } : {}),
      ...(d.pediatricianName !== undefined ? { pediatricianName: d.pediatricianName || null } : {}),
      ...(d.pediatricianPhone !== undefined ? { pediatricianPhone: d.pediatricianPhone || null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
    },
  });

  if (d.currentWeightGrams !== undefined && d.currentWeightGrams !== null && d.currentWeightGrams !== existing.currentWeightGrams) {
    await prisma.weightLog.create({ data: { babyId: baby.id, weightGrams: d.currentWeightGrams } });
  }

  await recordAudit(prisma, { consultantId, action: "BABY_UPDATED", entityType: "Baby", entityId: baby.id });
  return c.json({ baby });
});

// POST /api/babies/:id/archive
app.post("/babies/:id/archive", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const existing = await prisma.baby.findFirst({ where: { id, client: { consultantId } } });
  if (!existing) return c.json({ error: "Baby not found." }, 404);
  const baby = await prisma.baby.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
  await recordAudit(prisma, { consultantId, action: "BABY_ARCHIVED", entityType: "Baby", entityId: baby.id });
  return c.json({ baby });
});

// POST /api/babies/:id/restore
app.post("/babies/:id/restore", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const existing = await prisma.baby.findFirst({ where: { id, client: { consultantId } } });
  if (!existing) return c.json({ error: "Baby not found." }, 404);
  const baby = await prisma.baby.update({ where: { id: existing.id }, data: { archivedAt: null } });
  await recordAudit(prisma, { consultantId, action: "BABY_RESTORED", entityType: "Baby", entityId: baby.id });
  return c.json({ baby });
});

export default app;
