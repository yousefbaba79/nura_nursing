import type { Prisma } from "./lib/prisma";

export interface Bindings {
  DB: D1Database;
  BACKUPS: R2Bucket;
  BACKUP_RETENTION_DAYS?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
}

export interface Variables {
  prisma: Prisma;
  consultantId?: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
