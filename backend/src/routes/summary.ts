import { Router } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate);

async function loadShareableVisit(visitId: string, consultantId: string) {
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
router.get("/visits/:id/summary", async (req: AuthedRequest, res) => {
  const visit = await loadShareableVisit(req.params.id, req.consultantId!);
  if (!visit) return res.status(404).json({ error: "Visit not found." });

  res.json({
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

interface SelectedFields {
  clientQuestions?: boolean;
  solutionsDiscussed?: boolean;
  recommendationIds?: string[];
  actionItemIds?: string[];
  followUpPlan?: boolean;
  warningSignsDiscussed?: boolean;
}

// POST /api/visits/:id/summary/pdf - generates a client-friendly PDF from explicitly selected fields
router.post("/visits/:id/summary/pdf", async (req: AuthedRequest, res) => {
  const visit = await loadShareableVisit(req.params.id, req.consultantId!);
  if (!visit) return res.status(404).json({ error: "Visit not found." });

  const selection: SelectedFields = req.body || {};

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="visit-summary-${visit.id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text("Visit Summary", { align: "center" });
  doc.moveDown();
  doc.fontSize(11).text(`Client: ${visit.client.fullName}`);
  if (visit.babies.length) doc.text(`Baby/Babies: ${visit.babies.map((b) => b.baby.fullName).join(", ")}`);
  doc.text(`Visit date: ${visit.visitDate.toDateString()}`);
  doc.moveDown();

  if (selection.clientQuestions && visit.clientQuestions) {
    doc.fontSize(13).text("Questions Discussed", { underline: true });
    doc.fontSize(11).text(visit.clientQuestions);
    doc.moveDown();
  }

  if (selection.solutionsDiscussed && visit.solutionsDiscussed) {
    doc.fontSize(13).text("Recommendations Discussed", { underline: true });
    doc.fontSize(11).text(visit.solutionsDiscussed);
    doc.moveDown();
  }

  const recs = visit.recommendations.filter((r) => !selection.recommendationIds || selection.recommendationIds.includes(r.id));
  if (recs.length) {
    doc.fontSize(13).text("Recommendations", { underline: true });
    recs.forEach((r) => {
      doc.fontSize(11).text(`• ${r.title}${r.instructions ? " — " + r.instructions : ""}`);
    });
    doc.moveDown();
  }

  const items = visit.actionItems.filter((a) => !selection.actionItemIds || selection.actionItemIds.includes(a.id));
  if (items.length) {
    doc.fontSize(13).text("Action Items", { underline: true });
    items.forEach((a) => {
      const due = a.dueDate ? ` (due ${a.dueDate.toDateString()})` : "";
      doc.fontSize(11).text(`• ${a.title}${due}${a.instructions ? " — " + a.instructions : ""}`);
    });
    doc.moveDown();
  }

  if (selection.warningSignsDiscussed && visit.warningSignsDiscussed) {
    doc.fontSize(13).text("Warning Signs to Watch For", { underline: true });
    doc.fontSize(11).text(visit.warningSignsDiscussed);
    doc.moveDown();
  }

  if (selection.followUpPlan && (visit.followUpPlan || visit.followUpDate)) {
    doc.fontSize(13).text("Follow-Up Plan", { underline: true });
    if (visit.followUpDate) doc.fontSize(11).text(`Next follow-up: ${visit.followUpDate.toDateString()}`);
    if (visit.followUpPlan) doc.fontSize(11).text(visit.followUpPlan);
    doc.moveDown();
  }

  if (visit.createdBy) {
    doc.moveDown();
    doc.fontSize(10).fillColor("#555").text("Prepared by:");
    doc.text(`${visit.createdBy.fullName}${visit.createdBy.professionalTitle ? ", " + visit.createdBy.professionalTitle : ""}`);
    if (visit.createdBy.clinicName) doc.text(visit.createdBy.clinicName);
    if (visit.createdBy.phone) doc.text(visit.createdBy.phone);
    if (visit.createdBy.email) doc.text(visit.createdBy.email);
  }

  doc.end();

  await recordAudit({ consultantId: req.consultantId!, action: "VISIT_SUMMARY_EXPORTED", entityType: "Visit", entityId: visit.id, details: "format=pdf" });
});

export default router;
