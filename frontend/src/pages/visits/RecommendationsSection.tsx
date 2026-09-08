import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../../api/client";
import { Modal, ConfirmDialog, Badge, ErrorBanner } from "../../components/ui";
import { PRIORITIES, PRIORITY_COLORS } from "../../api/enums";
import type { Recommendation, Problem, Baby } from "../../api/types";

interface Props {
  visitId: string;
  babies: Baby[];
  problems: Problem[];
  recommendations: Recommendation[];
  onChanged: () => void;
}

export default function RecommendationsSection({ visitId, babies, problems, recommendations, onChanged }: Props) {
  const { t } = useTranslation();
  const [modal, setModal] = useState<{ open: boolean; recommendation?: Recommendation | null }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Recommendation | null>(null);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{t("recommendations.title")}</h2>
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true })}>
          {t("recommendations.add")}
        </button>
      </div>
      {recommendations.length === 0 ? (
        <p className="text-sm text-gray-500">{t("recommendations.noneRecorded")}</p>
      ) : (
        <ul className="space-y-2">
          {recommendations.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 rounded-md border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {r.title} <Badge className={PRIORITY_COLORS[r.priority]}>{t(`enums.priority.${r.priority}`)}</Badge>
                  {!r.includeInSummary && <Badge className="bg-gray-100 text-gray-500">{t("recommendations.notSharedBadge")}</Badge>}
                </p>
                {r.instructions && <p className="mt-0.5 text-sm text-gray-600">{r.instructions}</p>}
                {r.problemId && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t("recommendations.relatedProblem", { title: problems.find((p) => p.id === r.problemId)?.title })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true, recommendation: r })}>
                  {t("common.edit")}
                </button>
                <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setDeleteTarget(r)}>
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.recommendation ? t("recommendations.editModalTitle") : t("recommendations.addModalTitle")}
      >
        <RecommendationForm
          visitId={visitId}
          babies={babies}
          problems={problems}
          recommendation={modal.recommendation}
          onCancel={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("recommendations.deleteConfirmTitle")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.delete(`/recommendations/${deleteTarget.id}`);
          setDeleteTarget(null);
          onChanged();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function RecommendationForm({
  visitId,
  babies,
  problems,
  recommendation,
  onSaved,
  onCancel,
}: {
  visitId: string;
  babies: Baby[];
  problems: Problem[];
  recommendation?: Recommendation | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(recommendation?.title || "");
  const [instructions, setInstructions] = useState(recommendation?.instructions || "");
  const [priority, setPriority] = useState(recommendation?.priority || "MEDIUM");
  const [problemId, setProblemId] = useState(recommendation?.problemId || "");
  const [babyId, setBabyId] = useState(recommendation?.babyId || "");
  const [includeInSummary, setIncludeInSummary] = useState(recommendation?.includeInSummary ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("recommendations.form.errorTitleRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title,
        instructions: instructions || null,
        priority,
        problemId: problemId || null,
        babyId: babyId || null,
        includeInSummary,
      };
      if (recommendation) await api.put(`/recommendations/${recommendation.id}`, payload);
      else await api.post(`/visits/${visitId}/recommendations`, payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, t("recommendations.form.couldNotSave")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="rec-title">{t("recommendations.form.title")}</label>
        <input id="rec-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="rec-instructions">{t("recommendations.form.instructions")}</label>
        <textarea id="rec-instructions" className="input" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="rec-priority">{t("recommendations.form.priority")}</label>
          <select id="rec-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`enums.priority.${p}`)}
              </option>
            ))}
          </select>
        </div>
        {problems.length > 0 && (
          <div>
            <label className="label" htmlFor="rec-problem">{t("recommendations.form.relatedProblem")}</label>
            <select id="rec-problem" className="input" value={problemId} onChange={(e) => setProblemId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}
        {babies.length > 0 && (
          <div className="col-span-2">
            <label className="label" htmlFor="rec-baby">{t("recommendations.form.relatedBaby")}</label>
            <select id="rec-baby" className="input" value={babyId} onChange={(e) => setBabyId(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {babies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={includeInSummary} onChange={(e) => setIncludeInSummary(e.target.checked)} />
        {t("recommendations.form.includeInSummary")}
      </label>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t("common.saving") : recommendation ? t("common.saveChanges") : t("recommendations.form.addRecommendation")}
        </button>
      </div>
    </form>
  );
}
