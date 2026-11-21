import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authenticate } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use(authenticate);

app.get("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const [activeClientCount, upcomingFollowUps, overdueFollowUps, todayFollowUps] = await Promise.all([
    prisma.client.count({ where: { consultantId, status: { not: "ARCHIVED" } } }),
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
  ]);

  return c.json({
    stats: {
      activeClientCount,
      overdueFollowUpCount: overdueFollowUps.length,
    },
    todayFollowUps,
    upcomingFollowUps,
    overdueFollowUps,
  });
});

export default app;
