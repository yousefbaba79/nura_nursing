import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../../api/client";
import { Modal, ConfirmDialog, Badge, ErrorBanner } from "../../components/ui";
import { SEVERITIES, PROBLEM_STATUSES } from "../../api/enums";
import type { Problem, Baby } from "../../api/types";

interface Props {
  visitId: string;
  babies: Baby[];
  problems: Problem[];
  onChanged: () => void;
}

const severityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

export default function ProblemsSection({ visitId, babies, problems, onChanged }: Props) {
  const { t } = useTranslation();
  const [modal, setModal] = useState<{ open: boolean; problem?: Problem | null }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Problem | null>(null);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{t("problems.title")}</h2>
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true })}>
          {t("problems.add")}
        </button>
      </div>
      {problems.length === 0 ? (
        <p className="text-sm text-gray-500">{t("problems.noneRecorded")}</p>
      ) : (
        <ul className="space-y-2">
          {problems.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 rounded-md border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {p.title} <Badge className={severityColors[p.severity]}>{t(`enums.severity.${p.severity}`)}</Badge>{" "}
                  <Badge className="bg-gray-100 text-gray-700">{t(`enums.problemStatus.${p.status}`)}</Badge>
                </p>
                {p.description && <p className="mt-0.5 text-sm text-gray-600">{p.description}</p>}
                {p.babyId && <p className="mt-0.5 text-xs text-gray-500">{t("problems.relatedBaby", { name: babies.find((b) => b.id === p.babyId)?.fullName })}</p>}
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true, problem: p })}>
                  {t("common.edit")}
                </button>
                <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setDeleteTarget(p)}>
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.problem ? t("problems.editModalTitle") : t("problems.addModalTitle")}>
        <ProblemForm
          visitId={visitId}
          babies={babies}
          problem={modal.problem}
          onCancel={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("problems.deleteConfirmTitle")}
        description={t("problems.deleteConfirmDescription")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.delete(`/problems/${deleteTarget.id}`);
          setDeleteTarget(null);
          onChanged();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ProblemForm({
  visitId,
  babies,
  problem,
  onSaved,
  onCancel,
}: {
  visitId: string;
  babies: Baby[];
  problem?: Problem | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(problem?.title || "");
  const [description, setDescription] = useState(problem?.description || "");
  const [severity, setSeverity] = useState(problem?.severity || "MEDIUM");
  const [status, setStatus] = useState(problem?.status || "NEW");
  const [babyId, setBabyId] = useState(problem?.babyId || "");
  const [notes, setNotes] = useState(problem?.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("problems.form.errorTitleRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { title, description: description || null, severity, status, babyId: babyId || null, notes: notes || null };
      if (problem) await api.put(`/problems/${problem.id}`, payload);
      else await api.post(`/visits/${visitId}/problems`, payload);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, t("problems.form.couldNotSave")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="prob-title">{t("problems.form.title")}</label>
        <input id="prob-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="prob-description">{t("problems.form.description")}</label>
        <textarea id="prob-description" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="prob-severity">{t("problems.form.severity")}</label>
          <select id="prob-severity" className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`enums.severity.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="prob-status">{t("problems.form.status")}</label>
          <select id="prob-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {PROBLEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`enums.problemStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        {babies.length > 0 && (
          <div className="col-span-2">
            <label className="label" htmlFor="prob-baby">{t("problems.form.relatedBaby")}</label>
            <select id="prob-baby" className="input" value={babyId} onChange={(e) => setBabyId(e.target.value)}>
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
      <div>
        <label className="label" htmlFor="prob-notes">{t("problems.form.notes")}</label>
        <textarea id="prob-notes" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t("common.saving") : problem ? t("common.saveChanges") : t("problems.form.addProblem")}
        </button>
      </div>
    </form>
  );
}
