import { prisma } from "./prisma";

interface AuditParams {
  consultantId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}

export async function recordAudit(params: AuditParams) {
  try {
    await prisma.auditEntry.create({
      data: {
        consultantId: params.consultantId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        details: params.details ?? null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Auditing must never break the primary request flow.
    console.error("Failed to record audit entry", err);
  }
}
