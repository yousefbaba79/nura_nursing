-- AlterTable
ALTER TABLE "NoteTemplate" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: keep the existing (creation-date) order per consultant
UPDATE "NoteTemplate" SET "sortOrder" = (
    SELECT COUNT(*) FROM "NoteTemplate" AS t2
    WHERE t2."consultantId" = "NoteTemplate"."consultantId"
      AND (t2."createdAt" < "NoteTemplate"."createdAt"
           OR (t2."createdAt" = "NoteTemplate"."createdAt" AND t2."id" < "NoteTemplate"."id"))
);
