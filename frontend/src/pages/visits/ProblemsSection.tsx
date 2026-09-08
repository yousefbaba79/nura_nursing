import { useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { Modal, ConfirmDialog, Badge, ErrorBanner } from "../../components/ui";
import { SEVERITIES, PROBLEM_STATUSES, labelize } from "../../api/enums";
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
  const [modal, setModal] = useState<{ open: boolean; problem?: Problem | null }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<Problem | null>(null);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Identified problems</h2>
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true })}>
          + Add problem
        </button>
      </div>
      {problems.length === 0 ? (
        <p className="text-sm text-gray-500">No problems recorded for this visit.</p>
      ) : (
        <ul className="space-y-2">
          {problems.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 rounded-md border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {p.title} <Badge className={severityColors[p.severity]}>{labelize(p.severity)}</Badge>{" "}
                  <Badge className="bg-gray-100 text-gray-700">{labelize(p.status)}</Badge>
                </p>
                {p.description && <p className="mt-0.5 text-sm text-gray-600">{p.description}</p>}
                {p.babyId && <p className="mt-0.5 text-xs text-gray-500">Baby: {babies.find((b) => b.id === p.babyId)?.fullName}</p>}
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true, problem: p })}>
                  Edit
                </button>
                <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setDeleteTarget(p)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.problem ? "Edit problem" : "Add problem"}>
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
        title="Delete this problem?"
        description="This will also remove its link to any related recommendations or action items."
        confirmLabel="Delete"
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
      setError("Problem title is required.");
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
      setError(apiErrorMessage(err, "Could not save problem."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="prob-title">Problem title</label>
        <input id="prob-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="prob-description">Detailed description</label>
        <textarea id="prob-description" className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="prob-severity">Severity</label>
          <select id="prob-severity" className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="prob-status">Status</label>
          <select id="prob-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {PROBLEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </div>
        {babies.length > 0 && (
          <div className="col-span-2">
            <label className="label" htmlFor="prob-baby">Related baby</label>
            <select id="prob-baby" className="input" value={babyId} onChange={(e) => setBabyId(e.target.value)}>
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
      <div>
        <label className="label" htmlFor="prob-notes">Notes</label>
        <textarea id="prob-notes" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : problem ? "Save changes" : "Add problem"}
        </button>
      </div>
    </form>
  );
}
