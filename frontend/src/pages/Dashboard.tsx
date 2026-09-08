import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Spinner, EmptyState, Badge } from "../components/ui";
import { formatDate, formatDateTime, isOverdue } from "../lib/format";
import { PRIORITY_COLORS } from "../api/enums";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { consultant } = useAuth();
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t("dashboard.welcomeBack", { name: consultant ? consultant.fullName.split(" ")[0] : "" })}
          </h1>
          <p className="text-sm text-gray-500">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => navigate("/clients?new=1")}>
            {t("dashboard.addClient")}
          </button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t("dashboard.stats.activeClients")} value={data.stats.activeClientCount} to="/clients" />
            <StatCard
              label={t("dashboard.stats.overdueFollowUps")}
              value={data.stats.overdueFollowUpCount}
              to="/follow-ups?scope=overdue"
              alert={data.stats.overdueFollowUpCount > 0}
            />
            <StatCard label={t("dashboard.stats.overdueActionItems")} value={data.stats.overdueActionItemCount} alert={data.stats.overdueActionItemCount > 0} />
            <StatCard label={t("dashboard.stats.draftVisits")} value={data.stats.incompleteDraftCount} alert={data.stats.incompleteDraftCount > 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t("dashboard.sections.todayUpcomingFollowUps")} viewAllTo="/follow-ups">
              {[...data.todayFollowUps, ...data.upcomingFollowUps].length === 0 ? (
                <EmptyState title={t("dashboard.sections.noUpcomingFollowUps")} />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {[...data.todayFollowUps, ...data.upcomingFollowUps].slice(0, 6).map((f: any) => (
                    <li key={f.id}>
                      <Link to={`/clients/${f.client.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span>
                          <span className="font-medium text-gray-900">{f.client.fullName}</span>{" "}
                          <span className="text-gray-500">— {t(`enums.followUpType.${f.type}`)}</span>
                        </span>
                        <span className="text-gray-500">{formatDateTime(f.scheduledAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={t("dashboard.sections.overdueFollowUps")} viewAllTo="/follow-ups?scope=overdue">
              {data.overdueFollowUps.length === 0 ? (
                <EmptyState title={t("dashboard.sections.nothingOverdue")} description={t("dashboard.sections.nothingOverdueDescription")} />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.overdueFollowUps.slice(0, 6).map((f: any) => (
                    <li key={f.id}>
                      <Link to={`/clients/${f.client.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span className="font-medium text-gray-900">{f.client.fullName}</span>
                        <span className="text-red-600">{formatDateTime(f.scheduledAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={t("dashboard.sections.incompleteActionItems")}>
              {data.incompleteActionItems.length === 0 ? (
                <EmptyState title={t("dashboard.sections.noOpenActionItems")} />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.incompleteActionItems.slice(0, 8).map((a: any) => (
                    <li key={a.id}>
                      <Link to={`/clients/${a.client.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{a.title}</span>
                          <Badge className={PRIORITY_COLORS[a.priority]}>{t(`enums.priority.${a.priority}`)}</Badge>
                        </span>
                        <span className={isOverdue(a.dueDate) ? "font-medium text-red-600" : "text-gray-500"}>{formatDate(a.dueDate)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={t("dashboard.sections.recentVisits")}>
              {data.recentVisits.length === 0 ? (
                <EmptyState title={t("dashboard.sections.noVisitsYet")} />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recentVisits.map((v: any) => (
                    <li key={v.id}>
                      <Link to={`/visits/${v.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span className="font-medium text-gray-900">{v.client.fullName}</span>
                        <span className="text-gray-500">{formatDate(v.visitDate)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={t("dashboard.sections.recentlyViewedClients")}>
              {data.recentlyViewedClients.length === 0 ? (
                <EmptyState title={t("dashboard.sections.noClientsViewedYet")} />
              ) : (
                <ClientMiniList clients={data.recentlyViewedClients} />
              )}
            </Section>
            <Section title={t("dashboard.sections.recentlyAddedClients")}>
              {data.recentlyAddedClients.length === 0 ? (
                <EmptyState
                  title={t("dashboard.sections.noClientsYet")}
                  action={
                    <Link className="btn-primary" to="/clients?new=1">
                      {t("dashboard.sections.addFirstClient")}
                    </Link>
                  }
                />
              ) : (
                <ClientMiniList clients={data.recentlyAddedClients} />
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function ClientMiniList({ clients }: { clients: any[] }) {
  return (
    <ul className="divide-y divide-gray-100">
      {clients.map((c) => (
        <li key={c.id}>
          <Link to={`/clients/${c.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
            <span className="font-medium text-gray-900">{c.fullName}</span>
            <span className="text-gray-500">{c.phone}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatCard({ label, value, to, alert }: { label: string; value: number; to?: string; alert?: boolean }) {
  const content = (
    <div className={`card ${alert ? "border-amber-300 bg-amber-50" : ""}`}>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function Section({ title, children, viewAllTo }: { title: string; children: React.ReactNode; viewAllTo?: string }) {
  const { t } = useTranslation();
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-xs font-medium text-brand-700 hover:underline">
            {t("common.viewAll")}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
