import { Hono } from "hono";
import type { AppEnv } from "../types";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use(authenticate);

app.get("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const { from, to } = c.req.query();
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const [activeClientCount, followUpsInRange, clientsNeedingFollowUp, openActionItems, overdueActionItems, recentFollowUps] = await Promise.all([
    prisma.client.count({ where: { consultantId, status: { not: "ARCHIVED" } } }),
    prisma.followUp.count({ where: { client: { consultantId }, ...(from || to ? { scheduledAt: dateFilter } : {}) } }),
    prisma.client.count({ where: { consultantId, status: "FOLLOW_UP_REQUIRED" } }),
    prisma.actionItem.count({ where: { client: { consultantId }, status: { in: ["TODO", "IN_PROGRESS"] } } }),
    prisma.actionItem.count({ where: { client: { consultantId }, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: new Date() } } }),
    prisma.followUp.findMany({
      where: { client: { consultantId } },
      orderBy: { scheduledAt: "desc" },
      take: 10,
      include: { client: { select: { fullName: true } } },
    }),
  ]);

  return c.json({
    activeClientCount,
    followUpsInRange,
    clientsNeedingFollowUp,
    openActionItems,
    overdueActionItems,
    recentFollowUps,
  });
});

// GET /api/reports/clients.csv - basic CSV export of client data
app.get("/clients.csv", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const clients = await prisma.client.findMany({
    where: { consultantId },
    orderBy: { fullName: "asc" },
  });

  const headers = ["Full Name", "Phone", "Email", "Status", "City", "Client Number", "ID Number", "Created At", "Last Updated"];
  const rows = clients.map((cl) =>
    [cl.fullName, cl.phone, cl.email ?? "", cl.status, cl.city ?? "", cl.clientNumber ?? "", cl.idNumber ?? "", cl.createdAt.toISOString(), cl.updatedAt.toISOString()].map(
      (v) => `"${String(v).replace(/"/g, '""')}"`
    ).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");

  await recordAudit(prisma, { consultantId, action: "DATA_EXPORTED", entityType: "Client", details: "format=csv,scope=all" });

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="clients-export.csv"`);
  return c.body(csv);
});

export default app;
