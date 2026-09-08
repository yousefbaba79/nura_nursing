import { useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { Modal, ConfirmDialog, Badge, ErrorBanner } from "../../components/ui";
import { PRIORITIES, PRIORITY_COLORS, labelize } from "../../api/enums";
import type { Recommendation, Problem, Baby } from "../../api/types";

interface Props {
  visitId: string;
  babies: Baby[];
  problems: Problem[];
  recommendations: Recommendation[];
  onChanged: () => void;
}

export default function RecommendationsSection({ visitId, babies, problems, recommendations, onChanged }: Props) {
  const [modal, setModal] = useState<{ open: boolean; recommendation?: Recommendation | null }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Recommendation | null>(null);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Recommendations</h2>
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true })}>
          + Add recommendation
        </button>
      </div>
      {recommendations.length === 0 ? (
        <p className="text-sm text-gray-500">No recommendations recorded for this visit.</p>
      ) : (
        <ul className="space-y-2">
          {recommendations.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 rounded-md border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {r.title} <Badge className={PRIORITY_COLORS[r.priority]}>{labelize(r.priority)}</Badge>
                  {!r.includeInSummary && <Badge className="bg-gray-100 text-gray-500">Not shared with client</Badge>}
                </p>
                {r.instructions && <p className="mt-0.5 text-sm text-gray-600">{r.instructions}</p>}
                {r.problemId && <p className="mt-0.5 text-xs text-gray-500">Related problem: {problems.find((p) => p.id === r.problemId)?.title}</p>}
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true, recommendation: r })}>
                  Edit
                </button>
                <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setDeleteTarget(r)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.recommendation ? "Edit recommendation" : "Add recommendation"}>
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
        title="Delete this recommendation?"
        confirmLabel="Delete"
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
      setError("Recommendation title is required.");
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
      setError(apiErrorMessage(err, "Could not save recommendation."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="rec-title">Recommendation title</label>
        <input id="rec-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="rec-instructions">Detailed instructions</label>
        <textarea id="rec-instructions" className="input" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="rec-priority">Priority</label>
          <select id="rec-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {labelize(p)}
              </option>
            ))}
          </select>
        </div>
        {problems.length > 0 && (
          <div>
            <label className="label" htmlFor="rec-problem">Related problem</label>
            <select id="rec-problem" className="input" value={problemId} onChange={(e) => setProblemId(e.target.value)}>
              <option value="">None</option>
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
            <label className="label" htmlFor="rec-baby">Related baby</label>
            <select id="rec-baby" className="input" value={babyId} onChange={(e) => setBabyId(e.target.value)}>
              <option value="">None</option>
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
        Can be included in the client summary
      </label>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : recommendation ? "Save changes" : "Add recommendation"}
        </button>
      </div>
    </form>
  );
}
