import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { Modal, Spinner, EmptyState, Badge } from "../../components/ui";
import ClientForm from "../../components/ClientForm";
import { CLIENT_STATUSES, CLIENT_STATUS_COLORS } from "../../api/enums";
import { formatDate } from "../../lib/format";
import type { Client } from "../../api/types";

export default function ClientList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const [search, setSearch] = useState(params.get("q") || "");

  const status = params.get("status") || "";
  const sort = params.get("sort") || "name";

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set("q", search);
      else next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", { q: params.get("q") || "", status, sort }],
    queryFn: async () =>
      (
        await api.get("/clients", {
          params: { q: params.get("q") || undefined, status: status || undefined, sort },
        })
      ).data.clients as Client[],
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t("clients.title")}</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm(true);
          }}
        >
          {t("clients.addClient")}
        </button>
      </div>

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder={t("clients.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("clients.searchAriaLabel")}
        />
        <select className="input sm:max-w-[200px]" value={status} onChange={(e) => setParam("status", e.target.value)} aria-label={t("clients.filterStatusAriaLabel")}>
          <option value="">{t("clients.allStatuses")}</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.clientStatus.${s}`)}
            </option>
          ))}
        </select>
        <select className="input sm:max-w-[220px]" value={sort} onChange={(e) => setParam("sort", e.target.value)} aria-label={t("clients.sortAriaLabel")}>
          <option value="name">{t("clients.sort.name")}</option>
          <option value="recent_added">{t("clients.sort.recentAdded")}</option>
          <option value="recent_updated">{t("clients.sort.recentUpdated")}</option>
          <option value="last_visit">{t("clients.sort.lastVisit")}</option>
          <option value="next_follow_up">{t("clients.sort.nextFollowUp")}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t("clients.noClientsFound")} description={t("clients.noClientsFoundDescription")} />
      ) : (
        <div className="card overflow-hidden !p-0">
          <ul className="divide-y divide-gray-100">
            {data.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/clients/${c.id}`)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-start hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{c.fullName}</p>
                    <p className="text-sm text-gray-500">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ""}
                      {c.babies && c.babies.length > 0 ? ` · ${c.babies.map((b) => b.fullName).join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {c.openActionItemCount ? (
                      <Badge className="bg-amber-100 text-amber-800">{t("clients.openTaskCount", { count: c.openActionItemCount })}</Badge>
                    ) : null}
                    <span className="text-gray-500">{t("clients.lastVisit", { date: formatDate(c.lastVisitDate) })}</span>
                    <Badge className={CLIENT_STATUS_COLORS[c.status]}>{t(`enums.clientStatus.${c.status}`)}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t("clients.addClientModalTitle")} wide>
        <ClientForm
          onCancel={() => setShowForm(false)}
          onSaved={(client) => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            navigate(`/clients/${client.id}`);
          }}
        />
      </Modal>
    </div>
  );
}
