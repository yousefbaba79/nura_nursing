import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";
import { CLIENT_STATUSES } from "../utils/enums";

const app = new Hono<AppEnv>();
app.use(authenticate);

const clientInput = z.object({
  fullName: z.string().min(1, "Full name is required."),
  phone: z.string().min(1, "Phone number is required."),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  dateOfBirth: z.string().optional().nullable(),
  idNumber: z.string().optional().nullable(),
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
app.get("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const { q, status, tag, sort, includeArchived } = c.req.query();

  const where: any = { consultantId };

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
      { idNumber: { contains: term } },
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
      followUps: { orderBy: { scheduledAt: "asc" }, select: { scheduledAt: true, status: true } },
    },
  });

  let result = clients.map((cl) => {
    const scheduled = cl.followUps.filter((f) => f.status === "SCHEDULED");
    const completed = cl.followUps.filter((f) => f.status === "COMPLETED");
    return {
      ...cl,
      lastVisitDate: completed.length ? completed[completed.length - 1].scheduledAt : null,
      nextFollowUpDate: scheduled.length ? scheduled[0].scheduledAt : null,
      followUps: undefined,
    };
  });

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

  return c.json({ clients: result });
});

// GET /api/clients/check-duplicate?phone=&email=&clientNumber=&idNumber=
app.get("/check-duplicate", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const { phone, email, clientNumber, idNumber, excludeId } = c.req.query();
  const or: any[] = [];
  if (phone) or.push({ phone });
  if (email) or.push({ email });
  if (clientNumber) or.push({ clientNumber });
  if (idNumber) or.push({ idNumber });
  if (or.length === 0) return c.json({ duplicates: [] });

  const duplicates = await prisma.client.findMany({
    where: {
      consultantId,
      OR: or,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, fullName: true, phone: true, email: true, clientNumber: true, idNumber: true, status: true },
  });
  return c.json({ duplicates });
});

// GET /api/clients/:id
app.get("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const client = await prisma.client.findFirst({
    where: { id, consultantId },
    include: {
      babies: { orderBy: { createdAt: "asc" } },
      followUps: { orderBy: { scheduledAt: "asc" } },
    },
  });
  if (!client) return c.json({ error: "Client not found." }, 404);

  await prisma.client.update({ where: { id: client.id }, data: { lastViewedAt: new Date() } });

  return c.json({ client });
});

// POST /api/clients
app.post("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const parsed = clientInput.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
  }
  const data = parsed.data;

  const client = await prisma.client.create({
    data: {
      consultantId,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email || null,
      dateOfBirth: toDate(data.dateOfBirth),
      idNumber: data.idNumber || null,
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

  await recordAudit(prisma, {
    consultantId,
    action: "CLIENT_CREATED",
    entityType: "Client",
    entityId: client.id,
    details: `fullName=${client.fullName}`,
  });

  return c.json({ client }, 201);
});

// PUT /api/clients/:id
app.put("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const existing = await prisma.client.findFirst({ where: { id, consultantId } });
  if (!existing) return c.json({ error: "Client not found." }, 404);

  const parsed = clientInput.partial().safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);
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
      ...(data.idNumber !== undefined ? { idNumber: data.idNumber || null } : {}),
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

  await recordAudit(prisma, {
    consultantId,
    action: "CLIENT_UPDATED",
    entityType: "Client",
    entityId: client.id,
    details: changedFields.length ? `changed=${changedFields.join(",")}` : undefined,
  });

  return c.json({ client });
});

// POST /api/clients/:id/archive
app.post("/:id/archive", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const existing = await prisma.client.findFirst({ where: { id, consultantId } });
  if (!existing) return c.json({ error: "Client not found." }, 404);

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await recordAudit(prisma, { consultantId, action: "CLIENT_ARCHIVED", entityType: "Client", entityId: client.id });
  return c.json({ client });
});

// POST /api/clients/:id/restore
app.post("/:id/restore", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const existing = await prisma.client.findFirst({ where: { id, consultantId } });
  if (!existing) return c.json({ error: "Client not found." }, 404);

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: { status: "ACTIVE", archivedAt: null },
  });
  await recordAudit(prisma, { consultantId, action: "CLIENT_RESTORED", entityType: "Client", entityId: client.id });
  return c.json({ client });
});

// DELETE /api/clients/:id - permanent delete, requires explicit confirm flag
app.delete("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const id = c.req.param("id");
  const existing = await prisma.client.findFirst({ where: { id, consultantId } });
  if (!existing) return c.json({ error: "Client not found." }, 404);
  if (c.req.query("confirm") !== "PERMANENTLY_DELETE") {
    return c.json({ error: "Permanent deletion requires explicit confirmation." }, 400);
  }
  if (existing.status !== "ARCHIVED") {
    return c.json({ error: "Only archived clients can be permanently deleted." }, 400);
  }

  await recordAudit(prisma, { consultantId, action: "CLIENT_DELETED", entityType: "Client", entityId: existing.id, details: `fullName=${existing.fullName}` });

  const babyIds = (await prisma.baby.findMany({ where: { clientId: existing.id }, select: { id: true } })).map((b) => b.id);

  await prisma.$transaction([
    prisma.weightLog.deleteMany({ where: { babyId: { in: babyIds } } }),
    prisma.followUp.deleteMany({ where: { clientId: existing.id } }),
    prisma.baby.deleteMany({ where: { clientId: existing.id } }),
    prisma.client.delete({ where: { id: existing.id } }),
  ]);

  return c.json({ ok: true });
});

export default app;
