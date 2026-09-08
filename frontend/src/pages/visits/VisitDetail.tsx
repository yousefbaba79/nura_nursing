import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Spinner, Badge, EmptyState } from "../../components/ui";
import { labelize } from "../../api/enums";
import { formatDate, formatDateTime } from "../../lib/format";
import ProblemsSection from "./ProblemsSection";
import RecommendationsSection from "./RecommendationsSection";
import ActionItemsSection from "./ActionItemsSection";
import type { Visit } from "../../api/types";

const FIELD_GROUPS: { title: string; fields: { key: keyof Visit; label: string }[] }[] = [
  {
    title: "Reason & goals",
    fields: [
      { key: "reasonForConsultation", label: "Reason for consultation" },
      { key: "clientGoals", label: "Client's goals" },
      { key: "clientQuestions", label: "Client's questions" },
      { key: "currentFeedingRoutine", label: "Current feeding routine" },
      { key: "problemsReported", label: "Problems reported by the client" },
    ],
  },
  {
    title: "Assessment",
    fields: [
      { key: "consultantObservations", label: "Consultant's observations" },
      { key: "feedingAssessment", label: "Feeding assessment" },
      { key: "breastAssessment", label: "Breast assessment" },
      { key: "babyAssessment", label: "Baby assessment" },
      { key: "latchAssessment", label: "Latch assessment" },
      { key: "milkTransferAssessment", label: "Milk transfer assessment" },
      { key: "weightInformation", label: "Weight information" },
      { key: "relevantMedicalInfo", label: "Relevant medical information" },
    ],
  },
  {
    title: "Plan",
    fields: [
      { key: "solutionsDiscussed", label: "Solutions discussed" },
      { key: "clientActionPlan", label: "Client action plan" },
      { key: "warningSignsDiscussed", label: "Warning signs discussed" },
      { key: "referrals", label: "Referrals to other professionals" },
      { key: "followUpPlan", label: "Follow-up plan" },
    ],
  },
  {
    title: "Private professional notes",
    fields: [{ key: "privateNotes", label: "Private notes (never shared with client)" }],
  },
];

export default function VisitDetail() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
            <h1 className="text-xl font-bold text-gray-900">{formatDate(visit.visitDate)} visit</h1>
            <Badge
              className={
                visit.status === "COMPLETED" ? "bg-green-100 text-green-800" : visit.status === "CANCELLED" ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-800"
              }
            >
              {labelize(visit.status)}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            {visit.client && (
              <Link to={`/clients/${visit.client.id}`} className="hover:text-brand-700">
                {visit.client.fullName}
              </Link>
            )}
            {" · "}
            {labelize(visit.visitType)}
            {visit.babies.length > 0 ? ` · ${visit.babies.map((b) => b.baby.fullName).join(", ")}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate(`/visits/${visit.id}/edit`)}>
            Edit visit
          </button>
          {visit.status === "COMPLETED" && (
            <button className="btn-primary" onClick={() => navigate(`/visits/${visit.id}/summary`)}>
              Generate summary
            </button>
          )}
        </div>
      </div>

      <div className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info label="Start" value={visit.startTime || "—"} />
        <Info label="End" value={visit.endTime || "—"} />
        <Info label="Location" value={visit.location || "—"} />
        <Info label="Follow-up date" value={formatDate(visit.followUpDate)} />
        <Info label="Created" value={formatDateTime(visit.createdAt)} />
        <Info label="Created by" value={visit.createdBy?.fullName || "—"} />
        <Info label="Last updated" value={formatDateTime(visit.updatedAt)} />
        <Info label="Updated by" value={visit.updatedBy?.fullName || "—"} />
      </div>

      {FIELD_GROUPS.map((group) => {
        const hasContent = group.fields.some((f) => (visit as any)[f.key]);
        if (!hasContent) return null;
        return (
          <div key={group.title} className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">{group.title}</h2>
            {group.fields.map((f) =>
              (visit as any)[f.key] ? (
                <div key={String(f.key)}>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{f.label}</p>
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
        <EmptyState title="No clinical detail recorded yet" description="Add problems, recommendations, or action items from the sections above." />
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
