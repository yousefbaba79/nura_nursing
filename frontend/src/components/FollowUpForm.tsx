import { type FormEvent, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { FOLLOW_UP_TYPES, FOLLOW_UP_STATUSES, labelize } from "../api/enums";
import { ErrorBanner } from "./ui";
import type { FollowUp, Baby } from "../api/types";

interface Props {
  clientId: string;
  visitId?: string;
  babies?: Baby[];
  followUp?: FollowUp | null;
  onSaved: (followUp: FollowUp) => void;
  onCancel: () => void;
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FollowUpForm({ clientId, visitId, babies, followUp, onSaved, onCancel }: Props) {
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(followUp?.scheduledAt));
  const [type, setType] = useState(followUp?.type || "CALL");
  const [reason, setReason] = useState(followUp?.reason || "");
  const [notes, setNotes] = useState(followUp?.notes || "");
  const [status, setStatus] = useState(followUp?.status || "SCHEDULED");
  const [babyId, setBabyId] = useState(followUp?.babyId || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!scheduledAt) {
      setError("Follow-up date and time are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        clientId,
        visitId: visitId || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        type,
        reason: reason || null,
        notes: notes || null,
        status,
        babyId: babyId || null,
      };
      const res = followUp ? await api.put(`/follow-ups/${followUp.id}`, payload) : await api.post("/follow-ups", payload);
      onSaved(res.data.followUp);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save follow-up."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="fu-scheduled">Date &amp; time</label>
          <input id="fu-scheduled" className="input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="fu-type">Type</label>
          <select id="fu-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {FOLLOW_UP_TYPES.map((t) => (
              <option key={t} value={t}>
                {labelize(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fu-status">Status</label>
          <select id="fu-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {FOLLOW_UP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </select>
        </div>
        {babies && babies.length > 0 && (
          <div>
            <label className="label" htmlFor="fu-baby">Related baby</label>
            <select id="fu-baby" className="input" value={babyId} onChange={(e) => setBabyId(e.target.value)}>
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
        <label className="label" htmlFor="fu-reason">Reason</label>
        <input id="fu-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="fu-notes">Notes</label>
        <textarea id="fu-notes" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : followUp ? "Save changes" : "Schedule follow-up"}
        </button>
      </div>
    </form>
  );
}
