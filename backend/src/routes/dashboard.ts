import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/", async (req: AuthedRequest, res) => {
  const consultantId = req.consultantId!;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [
    activeClientCount,
    recentlyViewedClients,
    recentlyAddedClients,
    upcomingFollowUps,
    overdueFollowUps,
    todayFollowUps,
    incompleteActionItems,
    overdueActionItems,
    recentVisits,
    incompleteDrafts,
  ] = await Promise.all([
    prisma.client.count({ where: { consultantId, status: { not: "ARCHIVED" } } }),
    prisma.client.findMany({
      where: { consultantId, lastViewedAt: { not: null } },
      orderBy: { lastViewedAt: "desc" },
      take: 5,
      select: { id: true, fullName: true, phone: true, status: true, lastViewedAt: true },
    }),
    prisma.client.findMany({
      where: { consultantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, fullName: true, phone: true, status: true, createdAt: true },
    }),
    prisma.followUp.findMany({
      where: { client: { consultantId }, status: "SCHEDULED", scheduledAt: { gte: endOfToday } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { client: { select: { id: true, fullName: true } } },
    }),
    prisma.followUp.findMany({
      where: { client: { consultantId }, status: "SCHEDULED", scheduledAt: { lt: startOfToday } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      include: { client: { select: { id: true, fullName: true } } },
    }),
    prisma.followUp.findMany({
      where: { client: { consultantId }, status: "SCHEDULED", scheduledAt: { gte: startOfToday, lt: endOfToday } },
      orderBy: { scheduledAt: "asc" },
      include: { client: { select: { id: true, fullName: true } } },
    }),
    prisma.actionItem.findMany({
      where: { client: { consultantId }, status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: { client: { select: { id: true, fullName: true } } },
    }),
    prisma.actionItem.count({
      where: { client: { consultantId }, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } },
    }),
    prisma.visit.findMany({
      where: { client: { consultantId } },
      orderBy: { visitDate: "desc" },
      take: 5,
      include: { client: { select: { id: true, fullName: true } } },
    }),
    prisma.visit.count({ where: { client: { consultantId }, status: "DRAFT" } }),
  ]);

  res.json({
    stats: {
      activeClientCount,
      overdueFollowUpCount: overdueFollowUps.length,
      overdueActionItemCount: overdueActionItems,
      incompleteDraftCount: incompleteDrafts,
    },
    recentlyViewedClients,
    recentlyAddedClients,
    todayFollowUps,
    upcomingFollowUps,
    overdueFollowUps,
    incompleteActionItems,
    recentVisits,
  });
});

export default router;
