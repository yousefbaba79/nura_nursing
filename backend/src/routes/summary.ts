import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { Prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use(authenticate);

async function loadShareableVisit(prisma: Prisma, visitId: string, consultantId: string) {
  return prisma.visit.findFirst({
    where: { id: visitId, client: { consultantId } },
    include: {
      client: true,
      babies: { include: { baby: { select: { id: true, fullName: true } } } },
      recommendations: { where: { includeInSummary: true } },
      actionItems: true,
      createdBy: { select: { fullName: true, professionalTitle: true, phone: true, email: true, clinicName: true } },
    },
  });
}

// GET /api/visits/:id/summary - shareable data only (never private notes / internal assessments)
app.get("/visits/:id/summary", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const visit = await loadShareableVisit(prisma, c.req.param("id"), consultantId);
  if (!visit) return c.json({ error: "Visit not found." }, 404);

  return c.json({
    summary: {
      clientName: visit.client.fullName,
      babyNames: visit.babies.map((b) => b.baby.fullName),
      visitDate: visit.visitDate,
      visitType: visit.visitType,
      clientQuestions: visit.clientQuestions,
      solutionsDiscussed: visit.solutionsDiscussed,
      recommendations: visit.recommendations.map((r) => ({ id: r.id, title: r.title, instructions: r.instructions })),
      actionItems: visit.actionItems
        .filter((a) => a.status !== "CANCELLED")
        .map((a) => ({ id: a.id, title: a.title, instructions: a.instructions, dueDate: a.dueDate })),
      followUpPlan: visit.followUpPlan,
      followUpDate: visit.followUpDate,
      warningSignsDiscussed: visit.warningSignsDiscussed,
      consultant: visit.createdBy,
    },
  });
});

// POST /api/visits/:id/summary/exported - the PDF itself is generated client-side
// (pdfkit's disk-based font loading has no equivalent in the Workers runtime), but
// the export is still audit-logged server-side.
app.post("/visits/:id/summary/exported", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const visit = await loadShareableVisit(prisma, c.req.param("id"), consultantId);
  if (!visit) return c.json({ error: "Visit not found." }, 404);

  await recordAudit(prisma, { consultantId, action: "VISIT_SUMMARY_EXPORTED", entityType: "Visit", entityId: visit.id, details: "format=pdf" });
  return c.json({ ok: true });
});

export default app;
