import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Spinner } from "../components/ui";
import { formatDate } from "../lib/format";

export default function Reports() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => (await api.get("/reports")).data,
  });

  return (
    <div className="space-y-4">
      <div>
        <Link to="/settings" className="text-sm font-medium text-brand-700 hover:underline">
          {t("reports.backToSettings")}
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">{t("reports.title")}</h1>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("reports.stats.activeClients")} value={data.activeClientCount} />
            <Stat label={t("reports.stats.totalVisits")} value={data.visitsInRange} />
            <Stat label={t("reports.stats.needFollowUp")} value={data.clientsNeedingFollowUp} />
            <Stat label={t("reports.stats.openActionItems")} value={data.openActionItems} />
            <Stat label={t("reports.stats.overdueActionItems")} value={data.overdueActionItems} />
          </div>

          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">{t("reports.recentConsultations")}</h2>
            <ul className="divide-y divide-gray-100">
              {data.recentVisits.map((v: any) => (
                <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-gray-900">{v.client.fullName}</span>
                  <span className="text-gray-500">{formatDate(v.visitDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
