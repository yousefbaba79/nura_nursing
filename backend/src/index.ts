import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import clientRoutes from "./routes/clients";
import babyRoutes from "./routes/babies";
import visitRoutes from "./routes/visits";
import actionItemRoutes from "./routes/actionItems";
import followUpRoutes from "./routes/followUps";
import dashboardRoutes from "./routes/dashboard";
import settingsRoutes from "./routes/settings";
import auditRoutes from "./routes/audit";
import summaryRoutes from "./routes/summary";
import reportRoutes from "./routes/reports";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(","),
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api", babyRoutes); // /api/clients/:clientId/babies, /api/babies/:id
app.use("/api", visitRoutes); // /api/clients/:clientId/visits, /api/visits/:id, /api/problems, /api/recommendations
app.use("/api", summaryRoutes); // /api/visits/:id/summary(/pdf)
app.use("/api/action-items", actionItemRoutes);
app.use("/api/follow-ups", followUpRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit-log", auditRoutes);
app.use("/api/reports", reportRoutes);

// No sensitive information should reach logs.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err?.message || err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
