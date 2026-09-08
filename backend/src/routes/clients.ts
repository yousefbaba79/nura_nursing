import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";
import { CLIENT_STATUSES } from "../utils/enums";

const router = Router();
router.use(authenticate);

const clientInput = z.object({
  fullName: z.string().min(1, "Full name is required."),
  phone: z.string().min(1, "Phone number is required."),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  dateOfBirth: z.string().optional().nullable(),
  clientNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  preferredLanguage: z.string().optional().nullable(),
  preferredContactMethod: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  referralSource: z.string().optional().nullable(),
  generalNotes: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  status: z.enum(CLIENT_STATUSES).optional(),
  consentReceived: z.boolean().optional(),
  consentDate: z.string().optional().nullable(),
  consentMethod: z.string().optional().nullable(),
  consentFormVersion: z.string().optional().nullable(),
  consentNotes: z.string().optional().nullable(),
});

function toDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// GET /api/clients - list with search/filter/sort
router.get("/", async (req: AuthedRequest, res) => {
  const { q, status, tag, sort, includeArchived } = req.query as Record<string, string | undefined>;

  const where: any = { consultantId: req.consultantId };

  if (!includeArchived || includeArchived !== "true") {
    where.status = { not: "ARCHIVED" };
  }
  if (status) {
    where.status = status;
  }
  if (tag) {
    where.tags = { contains: tag };
  }

  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { fullName: { contains: term } },
      { phone: { contains: term } },
      { email: { contains: term } },
      { clientNumber: { contains: term } },
      { babies: { some: { fullName: { contains: term } } } },
    ];
  }

  let orderBy: any = { fullName: "asc" };
  switch (sort) {
    case "recent_added":
      orderBy = { createdAt: "desc" };
      break;
    case "recent_updated":
      orderBy = { updatedAt: "desc" };
      break;
    case "name":
      orderBy = { fullName: "asc" };
      break;
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy,
    include: {
      babies: { where: { archivedAt: null }, select: { id: true, fullName: true } },
      visits: { orderBy: { visitDate: "desc" }, take: 1, select: { visitDate: true } },
      followUps: {
        where: { status: "SCHEDULED" },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { scheduledAt: true },
      },
      _count: { select: { actionItems: { where: { status: { in: ["TODO", "IN_PROGRESS"] } } } } },
    },
  });

  let result = clients.map((c) => ({
    ...c,
    lastVisitDate: c.visits[0]?.visitDate ?? null,
    nextFollowUpDate: c.followUps[0]?.scheduledAt ?? null,
    openActionItemCount: c._count.actionItems,
    visits: undefined,
    followUps: undefined,
    _count: undefined,
  }));

  if (sort === "last_visit") {
    result = result.sort((a, b) => {
      const at = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
      const bt = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
      return bt - at;
    });
  } else if (sort === "next_follow_up") {
    result = result.sort((a, b) => {
      const at = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : Infinity;
      const bt = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : Infinity;
      return at - bt;
    });
  }

  res.json({ clients: result });
});

// GET /api/clients/check-duplicate?phone=&email=&clientNumber=
router.get("/check-duplicate", async (req: AuthedRequest, res) => {
  const { phone, email, clientNumber, excludeId } = req.query as Record<string, string | undefined>;
  const or: any[] = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  if (clientNumber) or.push({ clientNumber });
  if (or.length === 0) return res.json({ duplicates: [] });

  const duplicates = await prisma.client.findMany({
    where: {
      consultantId: req.consultantId,
      OR: or,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, fullName: true, phone: true, email: true, clientNumber: true, status: true },
  });
  res.json({ duplicates });
});

// GET /api/clients/:id
router.get("/:id", async (req: AuthedRequest, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, consultantId: req.consultantId },
    include: {
      babies: { orderBy: { createdAt: "asc" } },
      visits: {
        orderBy: { visitDate: "desc" },
        include: {
          problems: true,
          recommendations: true,
          actionItems: true,
          babies: { include: { baby: { select: { id: true, fullName: true } } } },
        },
      },
      actionItems: { orderBy: { dueDate: "asc" } },
      followUps: { orderBy: { scheduledAt: "asc" } },
    },
  });
  if (!client) return res.status(404).json({ error: "Client not found." });

  await prisma.client.update({ where: { id: client.id }, data: { lastViewedAt: new Date() } });

  res.json({ client });
});

// POST /api/clients
router.post("/", async (req: AuthedRequest, res) => {
  const parsed = clientInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const client = await prisma.client.create({
    data: {
      consultantId: req.consultantId!,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email || null,
      dateOfBirth: toDate(data.dateOfBirth),
      clientNumber: data.clientNumber || null,
      address: data.address || null,
      city: data.city || null,
      preferredLanguage: data.preferredLanguage || null,
      preferredContactMethod: data.preferredContactMethod || null,
      occupation: data.occupation || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      referralSource: data.referralSource || null,
      generalNotes: data.generalNotes || null,
      tags: data.tags || null,
      status: data.status || "ACTIVE",
      consentReceived: data.consentReceived ?? false,
      consentDate: toDate(data.consentDate),
      consentMethod: data.consentMethod || null,
      consentFormVersion: data.consentFormVersion || null,
      consentNotes: data.consentNotes || null,
    },
  });

  await recordAudit({
    consultantId: req.consultantId!,
    action: "CLIENT_CREATED",
    entityType: "Client",
    entityId: client.id,
    details: `fullName=${client.fullName}`,
  });

  res.status(201).json({ client });
});

// PUT /api/clients/:id
router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, consultantId: req.consultantId } });
  if (!existing) return res.status(404).json({ error: "Client not found." });

  const parsed = clientInput.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() });
  }
  const data = parsed.data;

  const changedFields: string[] = [];
  for (const key of Object.keys(data) as (keyof typeof data)[]) {
    if (key === "dateOfBirth" || key === "consentDate") continue;
    if ((existing as any)[key] !== (data as any)[key] && (data as any)[key] !== undefined) {
      changedFields.push(key);
    }
  }

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: {
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: toDate(data.dateOfBirth) } : {}),
      ...(data.clientNumber !== undefined ? { clientNumber: data.clientNumber || null } : {}),
      ...(data.address !== undefined ? { address: data.address || null } : {}),
      ...(data.city !== undefined ? { city: data.city || null } : {}),
      ...(data.preferredLanguage !== undefined ? { preferredLanguage: data.preferredLanguage || null } : {}),
      ...(data.preferredContactMethod !== undefined ? { preferredContactMethod: data.preferredContactMethod || null } : {}),
      ...(data.occupation !== undefined ? { occupation: data.occupation || null } : {}),
      ...(data.emergencyContactName !== undefined ? { emergencyContactName: data.emergencyContactName || null } : {}),
      ...(data.emergencyContactPhone !== undefined ? { emergencyContactPhone: data.emergencyContactPhone || null } : {}),
      ...(data.referralSource !== undefined ? { referralSource: data.referralSource || null } : {}),
      ...(data.generalNotes !== undefined ? { generalNotes: data.generalNotes || null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.consentReceived !== undefined ? { consentReceived: data.consentReceived } : {}),
      ...(data.consentDate !== undefined ? { consentDate: toDate(data.consentDate) } : {}),
      ...(data.consentMethod !== undefined ? { consentMethod: data.consentMethod || null } : {}),
      ...(data.consentFormVersion !== undefined ? { consentFormVersion: data.consentFormVersion || null } : {}),
      ...(data.consentNotes !== undefined ? { consentNotes: data.consentNotes || null } : {}),
    },
  });

  await recordAudit({
    consultantId: req.consultantId!,
    action: "CLIENT_UPDATED",
    entityType: "Client",
    entityId: client.id,
    details: changedFields.length ? `changed=${changedFields.join(",")}` : undefined,
  });

  res.json({ client });
});

// POST /api/clients/:id/archive
router.post("/:id/archive", async (req: AuthedRequest, res) => {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, consultantId: req.consultantId } });
  if (!existing) return res.status(404).json({ error: "Client not found." });

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await recordAudit({ consultantId: req.consultantId!, action: "CLIENT_ARCHIVED", entityType: "Client", entityId: client.id });
  res.json({ client });
});

// POST /api/clients/:id/restore
router.post("/:id/restore", async (req: AuthedRequest, res) => {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, consultantId: req.consultantId } });
  if (!existing) return res.status(404).json({ error: "Client not found." });

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: { status: "ACTIVE", archivedAt: null },
  });
  await recordAudit({ consultantId: req.consultantId!, action: "CLIENT_RESTORED", entityType: "Client", entityId: client.id });
  res.json({ client });
});

// DELETE /api/clients/:id - permanent delete, requires explicit confirm flag
router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.client.findFirst({ where: { id: req.params.id, consultantId: req.consultantId } });
  if (!existing) return res.status(404).json({ error: "Client not found." });
  if (req.query.confirm !== "PERMANENTLY_DELETE") {
    return res.status(400).json({ error: "Permanent deletion requires explicit confirmation." });
  }
  if (existing.status !== "ARCHIVED") {
    return res.status(400).json({ error: "Only archived clients can be permanently deleted." });
  }

  await recordAudit({ consultantId: req.consultantId!, action: "CLIENT_DELETED", entityType: "Client", entityId: existing.id, details: `fullName=${existing.fullName}` });

  const babyIds = (await prisma.baby.findMany({ where: { clientId: existing.id }, select: { id: true } })).map((b) => b.id);
  const visitIds = (await prisma.visit.findMany({ where: { clientId: existing.id }, select: { id: true } })).map((v) => v.id);

  await prisma.$transaction([
    prisma.weightLog.deleteMany({ where: { babyId: { in: babyIds } } }),
    prisma.actionItem.deleteMany({ where: { clientId: existing.id } }),
    prisma.recommendation.deleteMany({ where: { visitId: { in: visitIds } } }),
    prisma.problem.deleteMany({ where: { visitId: { in: visitIds } } }),
    prisma.followUp.deleteMany({ where: { clientId: existing.id } }),
    prisma.visitBaby.deleteMany({ where: { visitId: { in: visitIds } } }),
    prisma.visit.deleteMany({ where: { clientId: existing.id } }),
    prisma.baby.deleteMany({ where: { clientId: existing.id } }),
    prisma.client.delete({ where: { id: existing.id } }),
  ]);

  res.json({ ok: true });
});

export default router;
