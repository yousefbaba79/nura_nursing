import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Spinner, EmptyState } from "../components/ui";
import { formatDateTime } from "../lib/format";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLog() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => (await api.get("/audit-log", { params: { limit: 200 } })).data.entries as AuditEntry[],
  });

  return (
    <div className="space-y-4">
      <div>
        <Link to="/settings" className="text-sm font-medium text-brand-700 hover:underline">
          {t("auditLog.backToSettings")}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{t("auditLog.title")}</h1>
        <p className="text-sm text-gray-500">{t("auditLog.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t("auditLog.noEntries")} />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead>
              <tr className="text-start text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">{t("auditLog.columns.when")}</th>
                <th className="px-4 py-2">{t("auditLog.columns.action")}</th>
                <th className="px-4 py-2">{t("auditLog.columns.entity")}</th>
                <th className="px-4 py-2">{t("auditLog.columns.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{formatDateTime(e.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">
                    {t(`auditLog.actions.${e.action}`, { defaultValue: e.action.replace(/_/g, " ") })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{t(`auditLog.entities.${e.entityType}`, { defaultValue: e.entityType })}</td>
                  <td className="px-4 py-2 text-gray-500">{e.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
