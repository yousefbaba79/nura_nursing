import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate);

const profileInput = z.object({
  fullName: z.string().min(1).optional(),
  professionalTitle: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  clinicName: z.string().optional().nullable(),
  clinicAddress: z.string().optional().nullable(),
  profileImageUrl: z.string().optional().nullable(),
  defaultLanguage: z.string().optional(),
  timeZone: z.string().optional(),
  dateFormat: z.string().optional(),
  defaultVisitDurationMinutes: z.number().optional(),
  sessionTimeoutMinutes: z.number().optional(),
});

function sanitize(c: any) {
  const { passwordHash, ...rest } = c;
  return rest;
}

router.get("/profile", async (req: AuthedRequest, res) => {
  const consultant = await prisma.consultant.findUnique({ where: { id: req.consultantId! } });
  if (!consultant) return res.status(404).json({ error: "Account not found." });
  res.json({ consultant: sanitize(consultant) });
});

router.put("/profile", async (req: AuthedRequest, res) => {
  const parsed = profileInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  const d = parsed.data;
  const consultant = await prisma.consultant.update({
    where: { id: req.consultantId! },
    data: {
      ...(d.fullName !== undefined ? { fullName: d.fullName } : {}),
      ...(d.professionalTitle !== undefined ? { professionalTitle: d.professionalTitle || null } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.clinicName !== undefined ? { clinicName: d.clinicName || null } : {}),
      ...(d.clinicAddress !== undefined ? { clinicAddress: d.clinicAddress || null } : {}),
      ...(d.profileImageUrl !== undefined ? { profileImageUrl: d.profileImageUrl || null } : {}),
      ...(d.defaultLanguage !== undefined ? { defaultLanguage: d.defaultLanguage } : {}),
      ...(d.timeZone !== undefined ? { timeZone: d.timeZone } : {}),
      ...(d.dateFormat !== undefined ? { dateFormat: d.dateFormat } : {}),
      ...(d.defaultVisitDurationMinutes !== undefined ? { defaultVisitDurationMinutes: d.defaultVisitDurationMinutes } : {}),
      ...(d.sessionTimeoutMinutes !== undefined ? { sessionTimeoutMinutes: d.sessionTimeoutMinutes } : {}),
    },
  });
  await recordAudit({ consultantId: req.consultantId!, action: "PROFILE_UPDATED", entityType: "Consultant", entityId: req.consultantId });
  res.json({ consultant: sanitize(consultant) });
});

router.post("/deactivate", async (req: AuthedRequest, res) => {
  await prisma.consultant.update({ where: { id: req.consultantId! }, data: { isActive: false } });
  await recordAudit({ consultantId: req.consultantId!, action: "ACCOUNT_DEACTIVATED", entityType: "Consultant", entityId: req.consultantId });
  res.json({ ok: true });
});

export default router;
