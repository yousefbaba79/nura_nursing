import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";
import { VISIT_TYPES, VISIT_STATUSES } from "../utils/enums";

const router = Router();
router.use(authenticate);

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

async function assertClientOwnership(clientId: string, consultantId: string) {
  return prisma.client.findFirst({ where: { id: clientId, consultantId } });
}

async function assertVisitOwnership(visitId: string, consultantId: string) {
  return prisma.visit.findFirst({ where: { id: visitId, client: { consultantId } } });
}

async function syncVisitBabies(visitId: string, babyIds?: string[]) {
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
router.get("/clients/:clientId/visits", async (req: AuthedRequest, res) => {
  const client = await assertClientOwnership(req.params.clientId, req.consultantId!);
  if (!client) return res.status(404).json({ error: "Client not found." });
  const visits = await prisma.visit.findMany({
    where: { clientId: client.id },
    orderBy: { visitDate: "desc" },
    include: visitInclude,
  });
  res.json({ visits });
});

// POST /api/clients/:clientId/visits
router.post("/clients/:clientId/visits", async (req: AuthedRequest, res) => {
  const client = await assertClientOwnership(req.params.clientId, req.consultantId!);
  if (!client) return res.status(404).json({ error: "Client not found." });

  const parsed = visitInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  const d = parsed.data;

  const visit = await prisma.visit.create({
    data: {
      clientId: client.id,
      createdById: req.consultantId!,
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

  await syncVisitBabies(visit.id, d.babyIds);

  await recordAudit({ consultantId: req.consultantId!, action: "VISIT_CREATED", entityType: "Visit", entityId: visit.id, details: `clientId=${client.id}` });

  const full = await prisma.visit.findUnique({ where: { id: visit.id }, include: visitInclude });
  res.status(201).json({ visit: full });
});

// GET /api/visits/:id
router.get("/visits/:id", async (req: AuthedRequest, res) => {
  const visit = await prisma.visit.findFirst({
    where: { id: req.params.id, client: { consultantId: req.consultantId } },
    include: { ...visitInclude, client: { select: { id: true, fullName: true } } },
  });
  if (!visit) return res.status(404).json({ error: "Visit not found." });
  res.json({ visit });
});

// PUT /api/visits/:id - full edit (marks updatedBy)
router.put("/visits/:id", async (req: AuthedRequest, res) => {
  const existing = await assertVisitOwnership(req.params.id, req.consultantId!);
  if (!existing) return res.status(404).json({ error: "Visit not found." });

  const parsed = visitInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  const d = parsed.data;

  const visit = await prisma.visit.update({
    where: { id: existing.id },
    data: {
      updatedById: req.consultantId!,
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

  await syncVisitBabies(visit.id, d.babyIds);

  await recordAudit({ consultantId: req.consultantId!, action: "VISIT_UPDATED", entityType: "Visit", entityId: visit.id });

  const full = await prisma.visit.findUnique({ where: { id: visit.id }, include: visitInclude });
  res.json({ visit: full });
});

// PATCH /api/visits/:id/draft - lightweight autosave, no audit noise
router.patch("/visits/:id/draft", async (req: AuthedRequest, res) => {
  const existing = await assertVisitOwnership(req.params.id, req.consultantId!);
  if (!existing) return res.status(404).json({ error: "Visit not found." });
  if (existing.status !== "DRAFT") {
    return res.status(400).json({ error: "Only draft visits can be autosaved." });
  }

  const parsed = visitInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Could not save draft." });
  const d = parsed.data;

  const visit = await prisma.visit.update({
    where: { id: existing.id },
    data: {
      updatedById: req.consultantId!,
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

  if (d.babyIds !== undefined) await syncVisitBabies(visit.id, d.babyIds);

  res.json({ savedAt: visit.lastDraftSavedAt });
});

// DELETE /api/visits/:id - only drafts
router.delete("/visits/:id", async (req: AuthedRequest, res) => {
  const existing = await assertVisitOwnership(req.params.id, req.consultantId!);
  if (!existing) return res.status(404).json({ error: "Visit not found." });
  if (existing.status !== "DRAFT") {
    return res.status(400).json({ error: "Only draft visits can be deleted." });
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
  await recordAudit({ consultantId: req.consultantId!, action: "VISIT_DELETED", entityType: "Visit", entityId: existing.id });
  res.json({ ok: true });
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

router.post("/visits/:visitId/problems", async (req: AuthedRequest, res) => {
  const visit = await assertVisitOwnership(req.params.visitId, req.consultantId!);
  if (!visit) return res.status(404).json({ error: "Visit not found." });
  const parsed = problemInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  const d = parsed.data;
  const problem = await prisma.problem.create({
    data: { visitId: visit.id, title: d.title, description: d.description || null, severity: d.severity || "MEDIUM", status: d.status || "NEW", babyId: d.babyId || null, notes: d.notes || null },
  });
  res.status(201).json({ problem });
});

router.put("/problems/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.problem.findFirst({ where: { id: req.params.id, visit: { client: { consultantId: req.consultantId } } } });
  if (!existing) return res.status(404).json({ error: "Problem not found." });
  const parsed = problemInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields." });
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
  res.json({ problem });
});

router.delete("/problems/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.problem.findFirst({ where: { id: req.params.id, visit: { client: { consultantId: req.consultantId } } } });
  if (!existing) return res.status(404).json({ error: "Problem not found." });
  await prisma.actionItem.updateMany({ where: { problemId: existing.id }, data: { problemId: null } });
  await prisma.recommendation.updateMany({ where: { problemId: existing.id }, data: { problemId: null } });
  await prisma.problem.delete({ where: { id: existing.id } });
  res.json({ ok: true });
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

router.post("/visits/:visitId/recommendations", async (req: AuthedRequest, res) => {
  const visit = await assertVisitOwnership(req.params.visitId, req.consultantId!);
  if (!visit) return res.status(404).json({ error: "Visit not found." });
  const parsed = recommendationInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
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
  res.status(201).json({ recommendation });
});

router.put("/recommendations/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.recommendation.findFirst({ where: { id: req.params.id, visit: { client: { consultantId: req.consultantId } } } });
  if (!existing) return res.status(404).json({ error: "Recommendation not found." });
  const parsed = recommendationInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields." });
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
  res.json({ recommendation });
});

router.delete("/recommendations/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.recommendation.findFirst({ where: { id: req.params.id, visit: { client: { consultantId: req.consultantId } } } });
  if (!existing) return res.status(404).json({ error: "Recommendation not found." });
  await prisma.actionItem.updateMany({ where: { recommendationId: existing.id }, data: { recommendationId: null } });
  await prisma.recommendation.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;
