import { Router } from "express";
import { prisma } from "../lib/prisma";
import { recordAudit } from "../lib/audit";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/", async (req: AuthedRequest, res) => {
  const consultantId = req.consultantId!;
  const { from, to } = req.query as Record<string, string | undefined>;
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const [activeClientCount, visitsInRange, clientsNeedingFollowUp, openActionItems, overdueActionItems, recentVisits] = await Promise.all([
    prisma.client.count({ where: { consultantId, status: { not: "ARCHIVED" } } }),
    prisma.visit.count({ where: { client: { consultantId }, ...(from || to ? { visitDate: dateFilter } : {}) } }),
    prisma.client.count({ where: { consultantId, status: "FOLLOW_UP_REQUIRED" } }),
    prisma.actionItem.count({ where: { client: { consultantId }, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.actionItem.count({ where: { client: { consultantId }, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: new Date() } } }),
    prisma.visit.findMany({
      where: { client: { consultantId } },
      orderBy: { visitDate: "desc" },
      take: 10,
      include: { client: { select: { fullName: true } } },
    }),
  ]);

  res.json({
    activeClientCount,
    visitsInRange,
    clientsNeedingFollowUp,
    openActionItems,
    overdueActionItems,
    recentVisits,
  });
});

// GET /api/reports/clients.csv - basic CSV export of client data
router.get("/clients.csv", async (req: AuthedRequest, res) => {
  const clients = await prisma.client.findMany({
    where: { consultantId: req.consultantId },
    orderBy: { fullName: "asc" },
  });

  const headers = ["Full Name", "Phone", "Email", "Status", "City", "Client Number", "Created At", "Last Updated"];
  const rows = clients.map((c) =>
    [c.fullName, c.phone, c.email ?? "", c.status, c.city ?? "", c.clientNumber ?? "", c.createdAt.toISOString(), c.updatedAt.toISOString()].map(
      (v) => `"${String(v).replace(/"/g, '""')}"`
    ).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");

  await recordAudit({ consultantId: req.consultantId!, action: "DATA_EXPORTED", entityType: "Client", details: "format=csv,scope=all" });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="clients-export.csv"`);
  res.send(csv);
});

export default router;
