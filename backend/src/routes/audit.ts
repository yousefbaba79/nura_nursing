import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate);

// GET /api/audit-log?entityType=&entityId=&limit=
router.get("/", async (req: AuthedRequest, res) => {
  const { entityType, entityId, limit } = req.query as Record<string, string | undefined>;
  const where: any = { consultantId: req.consultantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const entries = await prisma.auditEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit ? Math.min(parseInt(limit, 10) || 100, 500) : 100,
  });
  res.json({ entries });
});

export default router;
