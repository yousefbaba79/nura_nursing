import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Spinner, EmptyState, Badge, Modal } from "../components/ui";
import FollowUpForm from "../components/FollowUpForm";
import { FOLLOW_UP_STATUS_COLORS } from "../api/enums";
import { formatDateTime } from "../lib/format";
import type { FollowUp } from "../api/types";

const SCOPES = [
  { key: "today", labelKey: "followUps.scopes.today" },
  { key: "upcoming", labelKey: "followUps.scopes.upcoming" },
  { key: "overdue", labelKey: "followUps.scopes.overdue" },
  { key: "completed", labelKey: "followUps.scopes.completed" },
];

const PERIODS = [
  { key: "all", labelKey: "followUps.periods.all" },
  { key: "this_month", labelKey: "followUps.periods.thisMonth" },
  { key: "last_month", labelKey: "followUps.periods.lastMonth" },
  { key: "this_year", labelKey: "followUps.periods.thisYear" },
  { key: "last_year", labelKey: "followUps.periods.lastYear" },
  { key: "custom", labelKey: "followUps.periods.custom" },
];

export default function FollowUps() {
  const [params, setParams] = useSearchParams();
  const scope = params.get("scope") || "today";
  const period = params.get("period") || "all";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [modal, setModal] = useState<{ open: boolean; item?: FollowUp | null }>({ open: false });

  const { data, isLoading } = useQuery({
    queryKey: ["follow-ups", scope, period, from, to],
    queryFn: async () =>
      (
        await api.get("/follow-ups", {
          params:
            scope === "completed" && period !== "all"
              ? { scope, period, ...(period === "custom" ? { from: from || undefined, to: to || undefined } : {}) }
              : { scope },
        })
      ).data.followUps as FollowUp[],
  });

  function setScope(key: string) {
    setParams({ scope: key });
  }

  function setPeriod(key: string) {
    setParams({ scope, period: key });
  }

  function setCustomRange(nextFrom: string, nextTo: string) {
    setParams({ scope, period: "custom", from: nextFrom, to: nextTo });
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function markCompleted(f: FollowUp) {
    await api.put(`/follow-ups/${f.id}`, { status: "COMPLETED" });
    invalidate();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t("followUps.title")}</h1>

      <div className="flex gap-2 overflow-x-auto">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
              scope === s.key ? "bg-brand-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200"
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      {scope === "completed" && (
        <div className="space-y-2">
          <select
            className="input max-w-[220px]"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label={t("followUps.periodFilterAriaLabel")}
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {t(p.labelKey)}
              </option>
            ))}
          </select>
          {period === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="follow-up-period-from">
                  {t("followUps.periodFrom")}
                </label>
                <input
                  id="follow-up-period-from"
                  type="date"
                  className="input"
                  value={from}
                  onChange={(e) => setCustomRange(e.target.value, to)}
                />
              </div>
              <div>
                <label className="label" htmlFor="follow-up-period-to">
                  {t("followUps.periodTo")}
                </label>
                <input id="follow-up-period-to" type="date" className="input" value={to} onChange={(e) => setCustomRange(from, e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t("followUps.noneHere")} />
      ) : (
        <div className="card overflow-hidden !p-0">
          <ul className="divide-y divide-gray-100">
            {data.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link to={`/clients/${f.client?.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                    {f.client?.fullName}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {t(`enums.followUpType.${f.type}`)} {f.reason ? `— ${f.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{formatDateTime(f.scheduledAt)}</span>
                  <Badge className={FOLLOW_UP_STATUS_COLORS[f.status]}>{t(`enums.followUpStatus.${f.status}`)}</Badge>
                  {f.client?.phone && (
                    <a href={`tel:${f.client.phone}`} className="text-sm font-medium text-brand-700 hover:underline">
                      {t("followUps.call")}
                    </a>
                  )}
                  <button className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true, item: f })}>
                    {t("common.edit")}
                  </button>
                  {f.status === "SCHEDULED" && (
                    <button className="text-sm font-medium text-green-700 hover:underline" onClick={() => markCompleted(f)}>
                      {t("followUps.markDone")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={t("followUps.editModalTitle")}>
        {modal.item && (
          <FollowUpForm
            clientId={modal.item.clientId}
            followUp={modal.item}
            onCancel={() => setModal({ open: false })}
            onSaved={() => {
              setModal({ open: false });
              invalidate();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
