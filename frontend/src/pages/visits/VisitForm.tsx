import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../../api/client";
import { ErrorBanner, Spinner } from "../../components/ui";
import { VISIT_TYPES, labelize } from "../../api/enums";
import type { Client, Visit } from "../../api/types";
import ProblemsSection from "./ProblemsSection";
import RecommendationsSection from "./RecommendationsSection";
import ActionItemsSection from "./ActionItemsSection";

const TEXT_FIELDS: { key: keyof Visit; label: string; group: string }[] = [
  { key: "reasonForConsultation", label: "Reason for consultation", group: "Reason & goals" },
  { key: "clientGoals", label: "Client's goals", group: "Reason & goals" },
  { key: "clientQuestions", label: "Client's questions", group: "Reason & goals" },
  { key: "currentFeedingRoutine", label: "Current feeding routine", group: "Reason & goals" },
  { key: "problemsReported", label: "Problems reported by the client", group: "Reason & goals" },

  { key: "consultantObservations", label: "Consultant's observations", group: "Assessment" },
  { key: "feedingAssessment", label: "Feeding assessment", group: "Assessment" },
  { key: "breastAssessment", label: "Breast assessment", group: "Assessment" },
  { key: "babyAssessment", label: "Baby assessment", group: "Assessment" },
  { key: "latchAssessment", label: "Latch assessment", group: "Assessment" },
  { key: "milkTransferAssessment", label: "Milk transfer assessment", group: "Assessment" },
  { key: "weightInformation", label: "Weight information", group: "Assessment" },
  { key: "relevantMedicalInfo", label: "Relevant medical information", group: "Assessment" },

  { key: "solutionsDiscussed", label: "Solutions discussed", group: "Plan" },
  { key: "clientActionPlan", label: "Client action plan", group: "Plan" },
  { key: "warningSignsDiscussed", label: "Warning signs discussed", group: "Plan" },
  { key: "referrals", label: "Referrals to other professionals", group: "Plan" },
  { key: "followUpPlan", label: "Follow-up plan", group: "Plan" },

  { key: "privateNotes", label: "Private professional notes (never shared with client)", group: "Private" },
];

const GROUPS = ["Reason & goals", "Assessment", "Plan", "Private"];

type FieldValues = Partial<Record<keyof Visit, string>>;

export default function VisitForm() {
  const { clientId, visitId: visitIdParam } = useParams<{ clientId?: string; visitId?: string }>();
  const navigate = useNavigate();

  const [visitId, setVisitId] = useState<string | null>(visitIdParam || null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [values, setValues] = useState<FieldValues>({});
  const [visitDate, setVisitDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [visitType, setVisitType] = useState("INITIAL_CONSULTATION");
  const [location, setLocation] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [babyIds, setBabyIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [completing, setCompleting] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create the draft immediately so autosave always has somewhere to write to.
  useEffect(() => {
    if (visitIdParam) return;
    if (!clientId) return;
    api
      .post(`/clients/${clientId}/visits`, {})
      .then((res) => {
        navigate(`/visits/${res.data.visit.id}/edit`, { replace: true });
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not start a new visit.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, visitIdParam]);

  const loadVisit = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/visits/${id}`);
      const v: Visit = res.data.visit;
      setVisit(v);
      setVisitId(v.id);
      setVisitDate(v.visitDate.slice(0, 10));
      setStartTime(v.startTime || "");
      setEndTime(v.endTime || "");
      setVisitType(v.visitType);
      setLocation(v.location || "");
      setFollowUpDate(v.followUpDate ? v.followUpDate.slice(0, 10) : "");
      setBabyIds(v.babies.map((b) => b.baby.id));
      const textValues: FieldValues = {};
      TEXT_FIELDS.forEach((f) => {
        textValues[f.key] = (v as any)[f.key] || "";
      });
      setValues(textValues);
      const clientRes = await api.get(`/clients/${v.clientId}`);
      setClient(clientRes.data.client);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load this visit."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visitIdParam) loadVisit(visitIdParam);
  }, [visitIdParam, loadVisit]);

  const isEditableDraft = visit?.status === "DRAFT";

  const scheduleAutosave = useCallback(
    (patch: Record<string, unknown>) => {
      if (!visitId || !isEditableDraft) return;
      setDirty(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await api.patch(`/visits/${visitId}/draft`, patch);
          setSavedAt(res.data.savedAt);
          setDirty(false);
        } catch {
          // Draft autosave failures are non-blocking; the consultant can still save manually.
        }
      }, 1200);
    },
    [visitId, isEditableDraft]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function updateText(key: keyof Visit, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    scheduleAutosave({ [key]: value });
  }

  function updateGeneral(patch: Record<string, unknown>) {
    scheduleAutosave(patch);
  }

  function toggleBaby(id: string) {
    const next = babyIds.includes(id) ? babyIds.filter((b) => b !== id) : [...babyIds, id];
    setBabyIds(next);
    scheduleAutosave({ babyIds: next });
  }

  async function saveNow(extra?: Record<string, unknown>) {
    if (!visitId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const payload = {
      visitDate,
      startTime: startTime || null,
      endTime: endTime || null,
      visitType,
      location: location || null,
      followUpDate: followUpDate || null,
      babyIds,
      ...values,
      ...extra,
    };
    const res = await api.put(`/visits/${visitId}`, payload);
    setVisit(res.data.visit);
    setDirty(false);
    return res.data.visit as Visit;
  }

  async function handleSaveDraft() {
    setError("");
    try {
      await saveNow();
      navigate(`/clients/${client?.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save visit."));
    }
  }

  async function handleComplete() {
    setError("");
    setCompleting(true);
    try {
      const saved = await saveNow({ status: "COMPLETED" });
      navigate(`/visits/${saved!.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not complete visit."));
    } finally {
      setCompleting(false);
    }
  }

  if (loading || !visitId) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <ErrorBanner message={error} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{visit?.status === "DRAFT" ? "New / draft visit" : "Edit visit"}</h1>
          {client && <p className="text-sm text-gray-500">Client: {client.fullName}</p>}
        </div>
        <p className="text-xs text-gray-500">
          {dirty ? "Saving…" : savedAt ? `Draft saved ${new Date(savedAt).toLocaleTimeString()}` : visit?.lastDraftSavedAt ? `Draft saved ${new Date(visit.lastDraftSavedAt).toLocaleTimeString()}` : ""}
        </p>
      </div>

      {!isEditableDraft && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          This visit is {visit?.status.toLowerCase()}. Changes below are saved when you click "Save changes".
        </div>
      )}

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">General information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Visit date</label>
            <input
              className="input"
              type="date"
              value={visitDate}
              onChange={(e) => {
                setVisitDate(e.target.value);
                updateGeneral({ visitDate: e.target.value });
              }}
            />
          </div>
          <div>
            <label className="label">Start time</label>
            <input
              className="input"
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                updateGeneral({ startTime: e.target.value });
              }}
            />
          </div>
          <div>
            <label className="label">End time</label>
            <input
              className="input"
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                updateGeneral({ endTime: e.target.value });
              }}
            />
          </div>
          <div>
            <label className="label">Visit type</label>
            <select
              className="input"
              value={visitType}
              onChange={(e) => {
                setVisitType(e.target.value);
                updateGeneral({ visitType: e.target.value });
              }}
            >
              {VISIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Location / method</label>
            <input
              className="input"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                updateGeneral({ location: e.target.value });
              }}
            />
          </div>
          <div>
            <label className="label">Follow-up date</label>
            <input
              className="input"
              type="date"
              value={followUpDate}
              onChange={(e) => {
                setFollowUpDate(e.target.value);
                updateGeneral({ followUpDate: e.target.value });
              }}
            />
          </div>
        </div>
        {client && client.babies && client.babies.length > 0 && (
          <div>
            <label className="label">Babies involved in this visit</label>
            <div className="flex flex-wrap gap-3">
              {client.babies.map((b) => (
                <label key={b.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm">
                  <input type="checkbox" checked={babyIds.includes(b.id)} onChange={() => toggleBaby(b.id)} />
                  {b.fullName}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {GROUPS.map((group) => (
        <div key={group} className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">{group}</h2>
          {TEXT_FIELDS.filter((f) => f.group === group).map((f) => (
            <div key={String(f.key)}>
              <label className="label">{f.label}</label>
              <textarea
                className="input"
                rows={f.group === "Private" ? 4 : 3}
                value={values[f.key] || ""}
                onChange={(e) => updateText(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}

      {visitId && client && (
        <>
          <ProblemsSection visitId={visitId} babies={client.babies || []} problems={visit?.problems || []} onChanged={() => loadVisit(visitId)} />
          <RecommendationsSection
            visitId={visitId}
            babies={client.babies || []}
            problems={visit?.problems || []}
            recommendations={visit?.recommendations || []}
            onChanged={() => loadVisit(visitId)}
          />
          <ActionItemsSection
            clientId={client.id}
            visitId={visitId}
            babies={client.babies || []}
            actionItems={visit?.actionItems || []}
            onChanged={() => loadVisit(visitId)}
          />
        </>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border">
        <button className="btn-secondary" onClick={() => navigate(client ? `/clients/${client.id}` : "/clients")}>
          Back to client
        </button>
        {isEditableDraft && (
          <button className="btn-secondary" onClick={handleSaveDraft}>
            Save as draft
          </button>
        )}
        <button className="btn-primary" onClick={handleComplete} disabled={completing}>
          {completing ? "Saving…" : isEditableDraft ? "Complete visit" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
