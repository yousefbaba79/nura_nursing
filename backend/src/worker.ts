import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./types";
import { createPrismaClient } from "./lib/prisma";

import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import babyRoutes from "./routes/babies";
import actionItemRoutes from "./routes/actionItems";
import followUpRoutes from "./routes/followUps";
import dashboardRoutes from "./routes/dashboard";
import settingsRoutes from "./routes/settings";
import auditRoutes from "./routes/audit";
import reportRoutes from "./routes/reports";
import noteTemplateRoutes from "./routes/noteTemplates";

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN.split(","),
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.use("/api/*", async (c, next) => {
  c.set("prisma", createPrismaClient(c.env.DB));
  await next();
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api/clients", clientRoutes);
app.route("/api", babyRoutes); // /api/clients/:clientId/babies, /api/babies/:id
app.route("/api/action-items", actionItemRoutes);
app.route("/api/follow-ups", followUpRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/audit-log", auditRoutes);
app.route("/api/reports", reportRoutes);
app.route("/api/note-templates", noteTemplateRoutes);

// No sensitive information should reach logs.
app.onError((err, c) => {
  console.error("Unhandled error:", err?.message || err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default app;
