import { type FormEvent, useState, cloneElement } from "react";
import { api, apiErrorMessage } from "../api/client";
import { FEEDING_METHODS, labelize } from "../api/enums";
import { ErrorBanner } from "./ui";
import type { Baby } from "../api/types";

interface Props {
  clientId: string;
  baby?: Baby | null;
  onSaved: (baby: Baby) => void;
  onCancel: () => void;
}

interface FormValues {
  fullName: string;
  dateOfBirth: string;
  sex: string;
  gestationalAgeWeeks: string;
  deliveryType: string;
  birthWeightGrams: string;
  currentWeightGrams: string;
  lengthCm: string;
  headCircumferenceCm: string;
  medicalConditions: string;
  medications: string;
  allergies: string;
  feedingMethod: string;
  dailyFeedsCount: string;
  supplementationInfo: string;
  hospitalInfo: string;
  pediatricianName: string;
  pediatricianPhone: string;
  notes: string;
}

function toFormValues(baby?: Baby | null): FormValues {
  return {
    fullName: baby?.fullName || "",
    dateOfBirth: baby?.dateOfBirth ? baby.dateOfBirth.slice(0, 10) : "",
    sex: baby?.sex || "",
    gestationalAgeWeeks: baby?.gestationalAgeWeeks || "",
    deliveryType: baby?.deliveryType || "",
    birthWeightGrams: baby?.birthWeightGrams != null ? String(baby.birthWeightGrams) : "",
    currentWeightGrams: baby?.currentWeightGrams != null ? String(baby.currentWeightGrams) : "",
    lengthCm: baby?.lengthCm != null ? String(baby.lengthCm) : "",
    headCircumferenceCm: baby?.headCircumferenceCm != null ? String(baby.headCircumferenceCm) : "",
    medicalConditions: baby?.medicalConditions || "",
    medications: baby?.medications || "",
    allergies: baby?.allergies || "",
    feedingMethod: baby?.feedingMethod || "",
    dailyFeedsCount: baby?.dailyFeedsCount != null ? String(baby.dailyFeedsCount) : "",
    supplementationInfo: baby?.supplementationInfo || "",
    hospitalInfo: baby?.hospitalInfo || "",
    pediatricianName: baby?.pediatricianName || "",
    pediatricianPhone: baby?.pediatricianPhone || "",
    notes: baby?.notes || "",
  };
}

export default function BabyForm({ clientId, baby, onSaved, onCancel }: Props) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(baby));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.fullName.trim()) {
      setError("Baby's name is required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...values,
        birthWeightGrams: values.birthWeightGrams ? Number(values.birthWeightGrams) : null,
        currentWeightGrams: values.currentWeightGrams ? Number(values.currentWeightGrams) : null,
        lengthCm: values.lengthCm ? Number(values.lengthCm) : null,
        headCircumferenceCm: values.headCircumferenceCm ? Number(values.headCircumferenceCm) : null,
        dailyFeedsCount: values.dailyFeedsCount ? Number(values.dailyFeedsCount) : null,
        feedingMethod: values.feedingMethod || null,
        dateOfBirth: values.dateOfBirth || null,
      };
      const res = baby ? await api.put(`/babies/${baby.id}`, payload) : await api.post(`/clients/${clientId}/babies`, payload);
      onSaved(res.data.baby);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save baby record."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <F label="Full name" required>
          <input className="input" value={values.fullName} onChange={(e) => update("fullName", e.target.value)} required />
        </F>
        <F label="Date of birth">
          <input className="input" type="date" value={values.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
        </F>
        <F label="Sex">
          <select className="input" value={values.sex} onChange={(e) => update("sex", e.target.value)}>
            <option value="">Not specified</option>
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </F>
        <F label="Gestational age at birth">
          <input className="input" value={values.gestationalAgeWeeks} onChange={(e) => update("gestationalAgeWeeks", e.target.value)} placeholder="e.g. 38 weeks" />
        </F>
        <F label="Type of delivery">
          <input className="input" value={values.deliveryType} onChange={(e) => update("deliveryType", e.target.value)} placeholder="e.g. vaginal, C-section" />
        </F>
        <F label="Feeding method">
          <select className="input" value={values.feedingMethod} onChange={(e) => update("feedingMethod", e.target.value)}>
            <option value="">Not specified</option>
            {FEEDING_METHODS.map((m) => (
              <option key={m} value={m}>
                {labelize(m)}
              </option>
            ))}
          </select>
        </F>
        <F label="Birth weight (g)">
          <input className="input" type="number" value={values.birthWeightGrams} onChange={(e) => update("birthWeightGrams", e.target.value)} />
        </F>
        <F label="Current weight (g)">
          <input className="input" type="number" value={values.currentWeightGrams} onChange={(e) => update("currentWeightGrams", e.target.value)} />
        </F>
        <F label="Length (cm)">
          <input className="input" type="number" value={values.lengthCm} onChange={(e) => update("lengthCm", e.target.value)} />
        </F>
        <F label="Head circumference (cm)">
          <input className="input" type="number" value={values.headCircumferenceCm} onChange={(e) => update("headCircumferenceCm", e.target.value)} />
        </F>
        <F label="Daily feeds count">
          <input className="input" type="number" value={values.dailyFeedsCount} onChange={(e) => update("dailyFeedsCount", e.target.value)} />
        </F>
        <F label="Pediatrician name">
          <input className="input" value={values.pediatricianName} onChange={(e) => update("pediatricianName", e.target.value)} />
        </F>
        <F label="Pediatrician phone">
          <input className="input" value={values.pediatricianPhone} onChange={(e) => update("pediatricianPhone", e.target.value)} />
        </F>
        <F label="Medical conditions" full>
          <textarea className="input" rows={2} value={values.medicalConditions} onChange={(e) => update("medicalConditions", e.target.value)} />
        </F>
        <F label="Medications" full>
          <textarea className="input" rows={2} value={values.medications} onChange={(e) => update("medications", e.target.value)} />
        </F>
        <F label="Allergies" full>
          <input className="input" value={values.allergies} onChange={(e) => update("allergies", e.target.value)} />
        </F>
        <F label="Supplementation information" full>
          <textarea className="input" rows={2} value={values.supplementationInfo} onChange={(e) => update("supplementationInfo", e.target.value)} />
        </F>
        <F label="Relevant hospital information" full>
          <textarea className="input" rows={2} value={values.hospitalInfo} onChange={(e) => update("hospitalInfo", e.target.value)} />
        </F>
        <F label="Notes" full>
          <textarea className="input" rows={2} value={values.notes} onChange={(e) => update("notes", e.target.value)} />
        </F>
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : baby ? "Save changes" : "Add baby"}
        </button>
      </div>
    </form>
  );
}

function F({ label, children, required, full }: { label: string; children: React.ReactElement<{ id?: string }>; required?: boolean; full?: boolean }) {
  const id = "field-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
