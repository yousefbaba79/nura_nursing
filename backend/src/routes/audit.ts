import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authenticate } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use(authenticate);

// GET /api/audit-log?entityType=&entityId=&limit=
app.get("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const { entityType, entityId, limit } = c.req.query();
  const where: any = { consultantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const entries = await prisma.auditEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit ? Math.min(parseInt(limit, 10) || 100, 500) : 100,
  });
  return c.json({ entries });
});

export default app;
