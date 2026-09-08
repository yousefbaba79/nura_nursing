import { type FormEvent, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { ACTION_ITEM_STATUSES, PRIORITIES, labelize } from "../api/enums";
import { ErrorBanner } from "./ui";
import type { ActionItem, Baby } from "../api/types";

interface Props {
  clientId: string;
  visitId?: string;
  babies?: Baby[];
  actionItem?: ActionItem | null;
  onSaved: (item: ActionItem) => void;
  onCancel: () => void;
}

export default function ActionItemForm({ clientId, visitId, babies, actionItem, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(actionItem?.title || "");
  const [instructions, setInstructions] = useState(actionItem?.instructions || "");
  const [dueDate, setDueDate] = useState(actionItem?.dueDate ? actionItem.dueDate.slice(0, 10) : "");
  const [priority, setPriority] = useState(actionItem?.priority || "MEDIUM");
  const [status, setStatus] = useState(actionItem?.status || "TODO");
  const [babyId, setBabyId] = useState(actionItem?.babyId || "");
  const [notes, setNotes] = useState(actionItem?.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        clientId,
        visitId: visitId || undefined,
        title,
        instructions: instructions || null,
        dueDate: dueDate || null,
        priority,
        status,
        babyId: babyId || null,
        notes: notes || null,
      };
      const res = actionItem ? await api.put(`/action-items/${actionItem.id}`, payload) : await api.post("/action-items", payload);
      onSaved(res.data.actionItem);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save action item."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="ai-title">Task title</label>
        <input id="ai-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="ai-instructions">Instructions</label>
        <textarea id="ai-instructions" className="input" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="ai-due">Due date</label>
          <input id="ai-due" className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="ai-priority">Priority</label>
          <select id="ai-priority" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {labelize(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ai-status">Status</label>
          <select id="ai-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {ACTION_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </div>
        {babies && babies.length > 0 && (
          <div>
            <label className="label" htmlFor="ai-baby">Related baby</label>
            <select id="ai-baby" className="input" value={babyId} onChange={(e) => setBabyId(e.target.value)}>
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
        <label className="label" htmlFor="ai-notes">Notes</label>
        <textarea id="ai-notes" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : actionItem ? "Save changes" : "Add task"}
        </button>
      </div>
    </form>
  );
}
