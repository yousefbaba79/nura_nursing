import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import type { Prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";
import { VISIT_TYPES, VISIT_STATUSES } from "../utils/enums";

const app = new Hono<AppEnv>();
app.use(authenticate);

const visitTextFields = [
  "reasonForConsultation",
  "clientGoals",
  "clientQuestions",
  "currentFeedingRoutine",
  "problemsReported",
  "consultantObservations",
  "feedingAssessment",
  "breastAssessment",
  "babyAssessment",
  "latchAssessment",
  "milkTransferAssessment",
  "weightInformation",
  "relevantMedicalInfo",
  "solutionsDiscussed",
  "clientActionPlan",
  "warningSignsDiscussed",
  "referrals",
  "followUpPlan",
  "privateNotes",
] as const;

const textFieldsSchema = Object.fromEntries(
  visitTextFields.map((f) => [f, z.string().optional().nullable()])
);

const visitInput = z.object({
  visitDate: z.string().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  visitType: z.enum(VISIT_TYPES).optional(),
  location: z.string().optional().nullable(),
  status: z.enum(VISIT_STATUSES).optional(),
  followUpDate: z.string().optional().nullable(),
  babyIds: z.array(z.string()).optional(),
  ...textFieldsSchema,
});

function toDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function buildTextData(d: any) {
  const out: any = {};
  for (const f of visitTextFields) {
    if (d[f] !== undefined) out[f] = d[f] || null;
  }
  return out;
}

async function assertClientOwnership(prisma: Prisma, clientId: string, consultantId: string) {
  return prisma.client.findFirst({ where: { id: clientId, consultantId } });
}

async function assertVisitOwnership(prisma: Prisma, visitId: string, consultantId: string) {
  return prisma.visit.findFirst({ where: { id: visitId, client: { consultantId } } });
}

async function syncVisitBabies(prisma: Prisma, visitId: string, babyIds?: string[]) {
  if (!babyIds) return;
  await prisma.visitBaby.deleteMany({ where: { visitId } });
  if (babyIds.length) {
    await prisma.visitBaby.createMany({ data: babyIds.map((babyId) => ({ visitId, babyId })) });
  }
}

const visitInclude = {
  babies: { include: { baby: { select: { id: true, fullName: true } } } },
  problems: true,
  recommendations: true,
  actionItems: true,
  followUps: true,
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
};

// GET /api/clients/:clientId/visits
app.get("/clients/:clientId/visits", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const client = await assertClientOwnership(prisma, c.req.param("clientId"), consultantId);
  if (!client) return c.json({ error: "Client not found." }, 404);
  const visits = await prisma.visit.findMany({
    where: { clientId: client.id },
    orderBy: { visitDate: "desc" },
    include: visitInclude,
  });
  return c.json({ visits });
});

// POST /api/clients/:clientId/visits
app.post("/clients/:clientId/visits", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const client = await assertClientOwnership(prisma, c.req.param("clientId"), consultantId);
  if (!client) return c.json({ error: "Client not found." }, 404);

  const parsed = visitInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;

  const visit = await prisma.visit.create({
    data: {
      clientId: client.id,
      createdById: consultantId,
      visitDate: toDate(d.visitDate) || new Date(),
      startTime: d.startTime || null,
      endTime: d.endTime || null,
      visitType: d.visitType || "INITIAL_CONSULTATION",
      location: d.location || null,
      status: d.status || "DRAFT",
      followUpDate: toDate(d.followUpDate),
      lastDraftSavedAt: new Date(),
      ...buildTextData(d),
    },
  });

  await syncVisitBabies(prisma, visit.id, d.babyIds);

  await recordAudit(prisma, { consultantId, action: "VISIT_CREATED", entityType: "Visit", entityId: visit.id, details: `clientId=${client.id}` });

  const full = await prisma.visit.findUnique({ where: { id: visit.id }, include: visitInclude });
  return c.json({ visit: full }, 201);
});

// GET /api/visits/:id
app.get("/visits/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const visit = await prisma.visit.findFirst({
    where: { id: c.req.param("id"), client: { consultantId } },
    include: { ...visitInclude, client: { select: { id: true, fullName: true } } },
  });
  if (!visit) return c.json({ error: "Visit not found." }, 404);
  return c.json({ visit });
});

// PUT /api/visits/:id - full edit (marks updatedBy)
app.put("/visits/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await assertVisitOwnership(prisma, c.req.param("id"), consultantId);
  if (!existing) return c.json({ error: "Visit not found." }, 404);

  const parsed = visitInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;

  const visit = await prisma.visit.update({
    where: { id: existing.id },
    data: {
      updatedById: consultantId,
      ...(d.visitDate !== undefined ? { visitDate: toDate(d.visitDate) || existing.visitDate } : {}),
      ...(d.startTime !== undefined ? { startTime: d.startTime || null } : {}),
      ...(d.endTime !== undefined ? { endTime: d.endTime || null } : {}),
      ...(d.visitType !== undefined ? { visitType: d.visitType } : {}),
      ...(d.location !== undefined ? { location: d.location || null } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.followUpDate !== undefined ? { followUpDate: toDate(d.followUpDate) } : {}),
      ...buildTextData(d),
    },
  });

  await syncVisitBabies(prisma, visit.id, d.babyIds);

  await recordAudit(prisma, { consultantId, action: "VISIT_UPDATED", entityType: "Visit", entityId: visit.id });

  const full = await prisma.visit.findUnique({ where: { id: visit.id }, include: visitInclude });
  return c.json({ visit: full });
});

// PATCH /api/visits/:id/draft - lightweight autosave, no audit noise
app.patch("/visits/:id/draft", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await assertVisitOwnership(prisma, c.req.param("id"), consultantId);
  if (!existing) return c.json({ error: "Visit not found." }, 404);
  if (existing.status !== "DRAFT") {
    return c.json({ error: "Only draft visits can be autosaved." }, 400);
  }

  const parsed = visitInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Could not save draft." }, 400);
  const d = parsed.data;

  const visit = await prisma.visit.update({
    where: { id: existing.id },
    data: {
      updatedById: consultantId,
      lastDraftSavedAt: new Date(),
      ...(d.visitDate !== undefined ? { visitDate: toDate(d.visitDate) || existing.visitDate } : {}),
      ...(d.startTime !== undefined ? { startTime: d.startTime || null } : {}),
      ...(d.endTime !== undefined ? { endTime: d.endTime || null } : {}),
      ...(d.visitType !== undefined ? { visitType: d.visitType } : {}),
      ...(d.location !== undefined ? { location: d.location || null } : {}),
      ...(d.followUpDate !== undefined ? { followUpDate: toDate(d.followUpDate) } : {}),
      ...buildTextData(d),
    },
  });

  if (d.babyIds !== undefined) await syncVisitBabies(prisma, visit.id, d.babyIds);

  return c.json({ savedAt: visit.lastDraftSavedAt });
});

// DELETE /api/visits/:id - only drafts
app.delete("/visits/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await assertVisitOwnership(prisma, c.req.param("id"), consultantId);
  if (!existing) return c.json({ error: "Visit not found." }, 404);
  if (existing.status !== "DRAFT") {
    return c.json({ error: "Only draft visits can be deleted." }, 400);
  }
  await prisma.$transaction([
    prisma.actionItem.updateMany({ where: { visitId: existing.id }, data: { visitId: null } }),
    prisma.recommendation.deleteMany({ where: { visitId: existing.id } }),
    prisma.problem.deleteMany({ where: { visitId: existing.id } }),
    prisma.visitBaby.deleteMany({ where: { visitId: existing.id } }),
    prisma.followUp.updateMany({ where: { visitId: existing.id }, data: { visitId: null } }),
    prisma.weightLog.updateMany({ where: { visitId: existing.id }, data: { visitId: null } }),
    prisma.visit.delete({ where: { id: existing.id } }),
  ]);
  await recordAudit(prisma, { consultantId, action: "VISIT_DELETED", entityType: "Visit", entityId: existing.id });
  return c.json({ ok: true });
});

// -----------------------------------------------------------------------
// Problems
// -----------------------------------------------------------------------

const problemInput = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.enum(["NEW", "IN_PROGRESS", "IMPROVED", "RESOLVED"]).optional(),
  babyId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

app.post("/visits/:visitId/problems", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const visit = await assertVisitOwnership(prisma, c.req.param("visitId"), consultantId);
  if (!visit) return c.json({ error: "Visit not found." }, 404);
  const parsed = problemInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;
  const problem = await prisma.problem.create({
    data: { visitId: visit.id, title: d.title, description: d.description || null, severity: d.severity || "MEDIUM", status: d.status || "NEW", babyId: d.babyId || null, notes: d.notes || null },
  });
  return c.json({ problem }, 201);
});

app.put("/problems/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.problem.findFirst({ where: { id: c.req.param("id"), visit: { client: { consultantId } } } });
  if (!existing) return c.json({ error: "Problem not found." }, 404);
  const parsed = problemInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields." }, 400);
  const d = parsed.data;
  const problem = await prisma.problem.update({
    where: { id: existing.id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.severity !== undefined ? { severity: d.severity } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.babyId !== undefined ? { babyId: d.babyId || null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
    },
  });
  return c.json({ problem });
});

app.delete("/problems/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.problem.findFirst({ where: { id: c.req.param("id"), visit: { client: { consultantId } } } });
  if (!existing) return c.json({ error: "Problem not found." }, 404);
  await prisma.actionItem.updateMany({ where: { problemId: existing.id }, data: { problemId: null } });
  await prisma.recommendation.updateMany({ where: { problemId: existing.id }, data: { problemId: null } });
  await prisma.problem.delete({ where: { id: existing.id } });
  return c.json({ ok: true });
});

// -----------------------------------------------------------------------
// Recommendations
// -----------------------------------------------------------------------

const recommendationInput = z.object({
  title: z.string().min(1),
  instructions: z.string().optional().nullable(),
  problemId: z.string().optional().nullable(),
  babyId: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  includeInSummary: z.boolean().optional(),
});

app.post("/visits/:visitId/recommendations", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const visit = await assertVisitOwnership(prisma, c.req.param("visitId"), consultantId);
  if (!visit) return c.json({ error: "Visit not found." }, 404);
  const parsed = recommendationInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;
  const recommendation = await prisma.recommendation.create({
    data: {
      visitId: visit.id,
      title: d.title,
      instructions: d.instructions || null,
      problemId: d.problemId || null,
      babyId: d.babyId || null,
      priority: d.priority || "MEDIUM",
      includeInSummary: d.includeInSummary ?? true,
    },
  });
  return c.json({ recommendation }, 201);
});

app.put("/recommendations/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.recommendation.findFirst({ where: { id: c.req.param("id"), visit: { client: { consultantId } } } });
  if (!existing) return c.json({ error: "Recommendation not found." }, 404);
  const parsed = recommendationInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields." }, 400);
  const d = parsed.data;
  const recommendation = await prisma.recommendation.update({
    where: { id: existing.id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.instructions !== undefined ? { instructions: d.instructions || null } : {}),
      ...(d.problemId !== undefined ? { problemId: d.problemId || null } : {}),
      ...(d.babyId !== undefined ? { babyId: d.babyId || null } : {}),
      ...(d.priority !== undefined ? { priority: d.priority } : {}),
      ...(d.includeInSummary !== undefined ? { includeInSummary: d.includeInSummary } : {}),
    },
  });
  return c.json({ recommendation });
});

app.delete("/recommendations/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.recommendation.findFirst({ where: { id: c.req.param("id"), visit: { client: { consultantId } } } });
  if (!existing) return c.json({ error: "Recommendation not found." }, 404);
  await prisma.actionItem.updateMany({ where: { recommendationId: existing.id }, data: { recommendationId: null } });
  await prisma.recommendation.delete({ where: { id: existing.id } });
  return c.json({ ok: true });
});

export default app;
