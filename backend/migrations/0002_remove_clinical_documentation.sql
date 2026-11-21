-- DropIndex
DROP INDEX "Visit_clientId_idx";

-- DropIndex
DROP INDEX "Visit_status_idx";

-- DropIndex
DROP INDEX "VisitBaby_visitId_babyId_key";

-- DropIndex
DROP INDEX "Problem_visitId_idx";

-- DropIndex
DROP INDEX "Recommendation_visitId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Visit";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "VisitBaby";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Problem";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Recommendation";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeightLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "babyId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightGrams" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeightLog_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WeightLog" ("babyId", "createdAt", "date", "id", "weightGrams") SELECT "babyId", "createdAt", "date", "id", "weightGrams" FROM "WeightLog";
DROP TABLE "WeightLog";
ALTER TABLE "new_WeightLog" RENAME TO "WeightLog";
CREATE INDEX "WeightLog_babyId_idx" ON "WeightLog"("babyId");
CREATE TABLE "new_ActionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "babyId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionItem_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ActionItem" ("babyId", "clientId", "completedAt", "createdAt", "dueDate", "id", "instructions", "notes", "priority", "status", "title", "updatedAt") SELECT "babyId", "clientId", "completedAt", "createdAt", "dueDate", "id", "instructions", "notes", "priority", "status", "title", "updatedAt" FROM "ActionItem";
DROP TABLE "ActionItem";
ALTER TABLE "new_ActionItem" RENAME TO "ActionItem";
CREATE INDEX "ActionItem_clientId_idx" ON "ActionItem"("clientId");
CREATE INDEX "ActionItem_status_idx" ON "ActionItem"("status");
CREATE INDEX "ActionItem_dueDate_idx" ON "ActionItem"("dueDate");
CREATE TABLE "new_FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "babyId" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CLINIC_VISIT',
    "reason" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_babyId_fkey" FOREIGN KEY ("babyId") REFERENCES "Baby" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FollowUp" ("babyId", "clientId", "createdAt", "id", "notes", "reason", "scheduledAt", "status", "type", "updatedAt") SELECT "babyId", "clientId", "createdAt", "id", "notes", "reason", "scheduledAt", "status", "type", "updatedAt" FROM "FollowUp";
DROP TABLE "FollowUp";
ALTER TABLE "new_FollowUp" RENAME TO "FollowUp";
CREATE INDEX "FollowUp_clientId_idx" ON "FollowUp"("clientId");
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");
CREATE INDEX "FollowUp_scheduledAt_idx" ON "FollowUp"("scheduledAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

