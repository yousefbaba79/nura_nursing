import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../../api/client";
import { Modal, ConfirmDialog, Spinner, EmptyState, Badge, ErrorBanner } from "../../components/ui";
import ClientForm from "../../components/ClientForm";
import BabyForm from "../../components/BabyForm";
import ActionItemForm from "../../components/ActionItemForm";
import FollowUpForm from "../../components/FollowUpForm";
import { CLIENT_STATUS_COLORS, FOLLOW_UP_STATUS_COLORS, PRIORITY_COLORS } from "../../api/enums";
import { formatDate, formatDateTime, isOverdue } from "../../lib/format";
import type { Client, Baby, ActionItem, FollowUp } from "../../api/types";

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [editOpen, setEditOpen] = useState(false);
  const [babyModal, setBabyModal] = useState<{ open: boolean; baby?: Baby | null }>({ open: false });
  const [actionModal, setActionModal] = useState<{ open: boolean; item?: ActionItem | null }>({ open: false });
  const [followUpModal, setFollowUpModal] = useState<{ open: boolean; item?: FollowUp | null }>({ open: false });
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [error, setError] = useState("");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => (await api.get(`/clients/${clientId}`)).data.client as Client,
    enabled: !!clientId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  async function handleArchiveToggle() {
    if (!client) return;
    try {
      if (client.status === "ARCHIVED") {
        await api.post(`/clients/${client.id}/restore`);
      } else {
        await api.post(`/clients/${client.id}/archive`);
      }
      setArchiveConfirm(false);
      invalidate();
    } catch (err) {
      setError(apiErrorMessage(err, t("clients.detail.couldNotUpdateClient")));
    }
  }

  async function toggleActionItemStatus(item: ActionItem) {
    const nextStatus = item.status === "COMPLETED" ? "TODO" : "COMPLETED";
    await api.put(`/action-items/${item.id}`, { status: nextStatus });
    invalidate();
  }

  if (isLoading || !client) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const openActionItems = (client.actionItems || []).filter((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED");
  const upcomingFollowUps = (client.followUps || []).filter((f) => f.status === "SCHEDULED");

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{client.fullName}</h1>
            <Badge className={CLIENT_STATUS_COLORS[client.status]}>{t(`enums.clientStatus.${client.status}`)}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
            <a href={`tel:${client.phone}`} className="hover:text-brand-700">
              📞 {client.phone}
            </a>
            {client.email && (
              <a href={`mailto:${client.email}`} className="hover:text-brand-700">
                ✉️ {client.email}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setEditOpen(true)}>
            {t("clients.detail.edit")}
          </button>
          <button className="btn-secondary" onClick={() => navigate(`/clients/${client.id}/visits/new`)}>
            {t("clients.detail.newVisit")}
          </button>
          <button className={client.status === "ARCHIVED" ? "btn-secondary" : "btn-secondary text-red-700"} onClick={() => setArchiveConfirm(true)}>
            {client.status === "ARCHIVED" ? t("clients.detail.restore") : t("clients.detail.archive")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title={t("clients.detail.babies")}
            action={
              <button className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setBabyModal({ open: true })}>
                {t("clients.detail.addBaby")}
              </button>
            }
          >
            {!client.babies || client.babies.length === 0 ? (
              <EmptyState title={t("clients.detail.noBabiesYet")} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {client.babies.map((b) => (
                  <div key={b.id} className={`rounded-md border p-3 ${b.archivedAt ? "border-gray-200 bg-gray-50 opacity-70" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{b.fullName}</p>
                      <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setBabyModal({ open: true, baby: b })}>
                        {t("clients.detail.edit")}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {b.dateOfBirth ? t("clients.detail.dobPrefix", { date: formatDate(b.dateOfBirth) }) : t("clients.detail.dobUnset")}
                      {b.feedingMethod ? ` · ${t(`enums.feedingMethod.${b.feedingMethod}`)}` : ""}
                    </p>
                    {b.currentWeightGrams ? (
                      <p className="text-xs text-gray-500">{t("clients.detail.currentWeight", { weight: b.currentWeightGrams })}</p>
                    ) : null}
                    {b.archivedAt && <p className="mt-1 text-xs text-gray-400">{t("clients.detail.archived")}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title={t("clients.detail.visitHistory")}
            action={
              <Link to={`/clients/${client.id}/visits/new`} className="text-sm font-medium text-brand-700 hover:underline">
                {t("clients.detail.newVisitLink")}
              </Link>
            }
          >
            {!client.visits || client.visits.length === 0 ? (
              <EmptyState title={t("clients.detail.noVisitsYet")} description={t("clients.detail.noVisitsYetDescription")} />
            ) : (
              <ul className="divide-y divide-gray-100">
                {client.visits.map((v) => (
                  <li key={v.id}>
                    <Link to={`/visits/${v.id}`} className="block py-3 hover:bg-gray-50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatDate(v.visitDate)} · {t(`enums.visitType.${v.visitType}`)}
                          </p>
                          {v.problems && v.problems.length > 0 && (
                            <p className="text-sm text-gray-500">{t("clients.detail.problemsLabel", { list: v.problems.map((p) => p.title).join(", ") })}</p>
                          )}
                          {v.recommendations && v.recommendations.length > 0 && (
                            <p className="text-sm text-gray-500">
                              {t("clients.detail.recommendationsLabel", { list: v.recommendations.map((r) => r.title).join(", ") })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {v.actionItems && v.actionItems.filter((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED").length > 0 && (
                            <Badge className="bg-amber-100 text-amber-800">
                              {t("clients.detail.openBadge", { count: v.actionItems.filter((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED").length })}
                            </Badge>
                          )}
                          <Badge
                            className={
                              v.status === "COMPLETED" ? "bg-green-100 text-green-800" : v.status === "CANCELLED" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-800"
                            }
                          >
                            {t(`enums.visitStatus.${v.status}`)}
                          </Badge>
                        </div>
                      </div>
                      {v.followUpDate && <p className="mt-1 text-xs text-gray-500">{t("clients.detail.followUpLabel", { date: formatDate(v.followUpDate) })}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {client.generalNotes && (
            <Section title={t("clients.detail.generalNotes")}>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{client.generalNotes}</p>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title={t("clients.detail.consent")}>
            <dl className="space-y-1 text-sm">
              <Row label={t("clients.detail.consentReceived")} value={client.consentReceived ? t("common.yes") : t("common.no")} />
              <Row label={t("clients.detail.consentDate")} value={formatDate(client.consentDate)} />
              <Row label={t("clients.detail.consentMethod")} value={client.consentMethod || "—"} />
              <Row label={t("clients.detail.consentFormVersion")} value={client.consentFormVersion || "—"} />
            </dl>
          </Section>

          <Section
            title={t("clients.detail.openActionItems")}
            action={
              <button className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setActionModal({ open: true })}>
                {t("clients.detail.addAction")}
              </button>
            }
          >
            {openActionItems.length === 0 ? (
              <EmptyState title={t("clients.detail.noOpenActionItems")} />
            ) : (
              <ul className="space-y-2">
                {openActionItems.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 rounded-md border border-gray-200 p-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={a.status === "COMPLETED"}
                      onChange={() => toggleActionItemStatus(a)}
                      aria-label={t("clients.detail.markComplete", { title: a.title })}
                    />
                    <button className="flex-1 text-start" onClick={() => setActionModal({ open: true, item: a })}>
                      <p className="text-sm font-medium text-gray-900">{a.title}</p>
                      <p className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={isOverdue(a.dueDate) ? "font-medium text-red-600" : ""}>{formatDate(a.dueDate)}</span>
                        <Badge className={PRIORITY_COLORS[a.priority]}>{t(`enums.priority.${a.priority}`)}</Badge>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title={t("clients.detail.followUps")}
            action={
              <button className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setFollowUpModal({ open: true })}>
                {t("clients.detail.schedule")}
              </button>
            }
          >
            {upcomingFollowUps.length === 0 ? (
              <EmptyState title={t("clients.detail.noFollowUpsScheduled")} />
            ) : (
              <ul className="space-y-2">
                {upcomingFollowUps.map((f) => (
                  <li key={f.id}>
                    <button className="w-full rounded-md border border-gray-200 p-2 text-start hover:bg-gray-50" onClick={() => setFollowUpModal({ open: true, item: f })}>
                      <p className="text-sm font-medium text-gray-900">{t(`enums.followUpType.${f.type}`)}</p>
                      <p className="flex items-center gap-2 text-xs text-gray-500">
                        {formatDateTime(f.scheduledAt)}
                        <Badge className={FOLLOW_UP_STATUS_COLORS[f.status]}>{t(`enums.followUpStatus.${f.status}`)}</Badge>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t("clients.detail.recordDetails")}>
            <dl className="space-y-1 text-sm">
              <Row label={t("clients.detail.created")} value={formatDate(client.createdAt)} />
              <Row label={t("clients.detail.lastUpdated")} value={formatDate(client.updatedAt)} />
            </dl>
          </Section>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t("clients.detail.editModalTitle")} wide>
        <ClientForm
          client={client}
          onCancel={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            invalidate();
          }}
        />
      </Modal>

      <Modal open={babyModal.open} onClose={() => setBabyModal({ open: false })} title={babyModal.baby ? t("clients.detail.editBabyModalTitle") : t("clients.detail.addBabyModalTitle")} wide>
        <BabyForm
          clientId={client.id}
          baby={babyModal.baby}
          onCancel={() => setBabyModal({ open: false })}
          onSaved={() => {
            setBabyModal({ open: false });
            invalidate();
          }}
        />
      </Modal>

      <Modal
        open={actionModal.open}
        onClose={() => setActionModal({ open: false })}
        title={actionModal.item ? t("clients.detail.editActionItemModalTitle") : t("clients.detail.addActionItemModalTitle")}
      >
        <ActionItemForm
          clientId={client.id}
          babies={client.babies}
          actionItem={actionModal.item}
          onCancel={() => setActionModal({ open: false })}
          onSaved={() => {
            setActionModal({ open: false });
            invalidate();
          }}
        />
      </Modal>

      <Modal
        open={followUpModal.open}
        onClose={() => setFollowUpModal({ open: false })}
        title={followUpModal.item ? t("clients.detail.editFollowUpModalTitle") : t("clients.detail.scheduleFollowUpModalTitle")}
      >
        <FollowUpForm
          clientId={client.id}
          babies={client.babies}
          followUp={followUpModal.item}
          onCancel={() => setFollowUpModal({ open: false })}
          onSaved={() => {
            setFollowUpModal({ open: false });
            invalidate();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={archiveConfirm}
        title={client.status === "ARCHIVED" ? t("clients.detail.archiveConfirmTitleRestore") : t("clients.detail.archiveConfirmTitleArchive")}
        description={client.status === "ARCHIVED" ? t("clients.detail.archiveConfirmDescriptionRestore") : t("clients.detail.archiveConfirmDescriptionArchive")}
        confirmLabel={client.status === "ARCHIVED" ? t("clients.detail.archiveConfirmLabelRestore") : t("clients.detail.archiveConfirmLabelArchive")}
        danger={client.status !== "ARCHIVED"}
        onConfirm={handleArchiveToggle}
        onCancel={() => setArchiveConfirm(false)}
      />
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-end text-gray-900">{value}</dd>
    </div>
  );
}
