import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { Spinner, Badge, EmptyState } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/format";
import ProblemsSection from "./ProblemsSection";
import RecommendationsSection from "./RecommendationsSection";
import ActionItemsSection from "./ActionItemsSection";
import type { Visit } from "../../api/types";

type GroupKey = "reasonGoals" | "assessment" | "plan" | "private";

const FIELD_GROUPS: { key: GroupKey; titleKey: string; fields: { key: keyof Visit; labelKey: string }[] }[] = [
  {
    key: "reasonGoals",
    titleKey: "visits.form.groupReasonGoals",
    fields: [
      { key: "reasonForConsultation", labelKey: "reasonForConsultation" },
      { key: "clientGoals", labelKey: "clientGoals" },
      { key: "clientQuestions", labelKey: "clientQuestions" },
      { key: "currentFeedingRoutine", labelKey: "currentFeedingRoutine" },
      { key: "problemsReported", labelKey: "problemsReported" },
    ],
  },
  {
    key: "assessment",
    titleKey: "visits.form.groupAssessment",
    fields: [
      { key: "consultantObservations", labelKey: "consultantObservations" },
      { key: "feedingAssessment", labelKey: "feedingAssessment" },
      { key: "breastAssessment", labelKey: "breastAssessment" },
      { key: "babyAssessment", labelKey: "babyAssessment" },
      { key: "latchAssessment", labelKey: "latchAssessment" },
      { key: "milkTransferAssessment", labelKey: "milkTransferAssessment" },
      { key: "weightInformation", labelKey: "weightInformation" },
      { key: "relevantMedicalInfo", labelKey: "relevantMedicalInfo" },
    ],
  },
  {
    key: "plan",
    titleKey: "visits.form.groupPlan",
    fields: [
      { key: "solutionsDiscussed", labelKey: "solutionsDiscussed" },
      { key: "clientActionPlan", labelKey: "clientActionPlan" },
      { key: "warningSignsDiscussed", labelKey: "warningSignsDiscussed" },
      { key: "referrals", labelKey: "referrals" },
      { key: "followUpPlan", labelKey: "followUpPlan" },
    ],
  },
  {
    key: "private",
    titleKey: "visits.detail.privateNotesGroupTitle",
    fields: [{ key: "privateNotes", labelKey: "privateNotes" }],
  },
];

export default function VisitDetail() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: visit, isLoading } = useQuery({
    queryKey: ["visit", visitId],
    queryFn: async () => (await api.get(`/visits/${visitId}`)).data.visit as Visit,
    enabled: !!visitId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["visit", visitId] });
  }

  if (isLoading || !visit) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{t("visits.detail.title", { date: formatDate(visit.visitDate) })}</h1>
            <Badge
              className={
                visit.status === "COMPLETED" ? "bg-green-100 text-green-800" : visit.status === "CANCELLED" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-800"
              }
            >
              {t(`enums.visitStatus.${visit.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {visit.client && (
              <Link to={`/clients/${visit.client.id}`} className="hover:text-brand-700">
                {visit.client.fullName}
              </Link>
            )}
            {" · "}
            {t(`enums.visitType.${visit.visitType}`)}
            {visit.babies.length > 0 ? ` · ${visit.babies.map((b) => b.baby.fullName).join(", ")}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate(`/visits/${visit.id}/edit`)}>
            {t("visits.detail.editVisit")}
          </button>
          {visit.status === "COMPLETED" && (
            <button className="btn-primary" onClick={() => navigate(`/visits/${visit.id}/summary`)}>
              {t("visits.detail.generateSummary")}
            </button>
          )}
        </div>
      </div>

      <div className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info label={t("visits.detail.start")} value={visit.startTime || "—"} />
        <Info label={t("visits.detail.end")} value={visit.endTime || "—"} />
        <Info label={t("visits.detail.location")} value={visit.location || "—"} />
        <Info label={t("visits.detail.followUpDate")} value={formatDate(visit.followUpDate)} />
        <Info label={t("visits.detail.created")} value={formatDateTime(visit.createdAt)} />
        <Info label={t("visits.detail.createdBy")} value={visit.createdBy?.fullName || "—"} />
        <Info label={t("visits.detail.lastUpdated")} value={formatDateTime(visit.updatedAt)} />
        <Info label={t("visits.detail.updatedBy")} value={visit.updatedBy?.fullName || "—"} />
      </div>

      {FIELD_GROUPS.map((group) => {
        const hasContent = group.fields.some((f) => (visit as any)[f.key]);
        if (!hasContent) return null;
        return (
          <div key={group.key} className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">{t(group.titleKey)}</h2>
            {group.fields.map((f) =>
              (visit as any)[f.key] ? (
                <div key={String(f.key)}>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t(`visits.form.field.${f.labelKey}`)}</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{(visit as any)[f.key]}</p>
                </div>
              ) : null
            )}
          </div>
        );
      })}

      <ProblemsSection visitId={visit.id} babies={visit.babies.map((b) => b.baby as any)} problems={visit.problems} onChanged={invalidate} />
      <RecommendationsSection
        visitId={visit.id}
        babies={visit.babies.map((b) => b.baby as any)}
        problems={visit.problems}
        recommendations={visit.recommendations}
        onChanged={invalidate}
      />
      {visit.client && (
        <ActionItemsSection
          clientId={visit.client.id}
          visitId={visit.id}
          babies={visit.babies.map((b) => b.baby as any)}
          actionItems={visit.actionItems}
          onChanged={invalidate}
        />
      )}

      {visit.problems.length === 0 && visit.recommendations.length === 0 && visit.actionItems.length === 0 && (
        <EmptyState title={t("visits.detail.noClinicalDetail")} description={t("visits.detail.noClinicalDetailDescription")} />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}
