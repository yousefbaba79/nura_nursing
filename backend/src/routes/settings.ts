import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use(authenticate);

const profileInput = z.object({
  fullName: z.string().min(1).optional(),
  professionalTitle: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  clinicName: z.string().optional().nullable(),
  clinicAddress: z.string().optional().nullable(),
  profileImageUrl: z.string().optional().nullable(),
  defaultLanguage: z.enum(["en", "he", "ar"]).optional(),
  timeZone: z.string().optional(),
  dateFormat: z.string().optional(),
  defaultVisitDurationMinutes: z.number().optional(),
  sessionTimeoutMinutes: z.number().optional(),
});

function sanitize(c: any) {
  const { passwordHash, ...rest } = c;
  return rest;
}

app.get("/profile", async (c) => {
  const prisma = c.get("prisma");
  const consultant = await prisma.consultant.findUnique({ where: { id: c.get("consultantId")! } });
  if (!consultant) return c.json({ error: "Account not found." }, 404);
  return c.json({ consultant: sanitize(consultant) });
});

app.put("/profile", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const parsed = profileInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  const d = parsed.data;
  const consultant = await prisma.consultant.update({
    where: { id: consultantId },
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
  await recordAudit(prisma, { consultantId, action: "PROFILE_UPDATED", entityType: "Consultant", entityId: consultantId });
  return c.json({ consultant: sanitize(consultant) });
});

app.post("/deactivate", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  await prisma.consultant.update({ where: { id: consultantId }, data: { isActive: false } });
  await recordAudit(prisma, { consultantId, action: "ACCOUNT_DEACTIVATED", entityType: "Consultant", entityId: consultantId });
  return c.json({ ok: true });
});

export default app;
