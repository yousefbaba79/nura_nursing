import { type FormEvent, useEffect, useState, cloneElement } from "react";
import { api, apiErrorMessage } from "../api/client";
import { CLIENT_STATUSES, CLIENT_STATUS_LABELS } from "../api/enums";
import { ErrorBanner } from "./ui";
import type { Client } from "../api/types";

export interface ClientFormValues {
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  clientNumber: string;
  address: string;
  city: string;
  preferredLanguage: string;
  preferredContactMethod: string;
  occupation: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  referralSource: string;
  generalNotes: string;
  tags: string;
  status: string;
  consentReceived: boolean;
  consentDate: string;
  consentMethod: string;
  consentFormVersion: string;
  consentNotes: string;
}

const emptyValues: ClientFormValues = {
  fullName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  clientNumber: "",
  address: "",
  city: "",
  preferredLanguage: "",
  preferredContactMethod: "",
  occupation: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  referralSource: "",
  generalNotes: "",
  tags: "",
  status: "ACTIVE",
  consentReceived: false,
  consentDate: "",
  consentMethod: "",
  consentFormVersion: "",
  consentNotes: "",
};

function toFormValues(client?: Client | null): ClientFormValues {
  if (!client) return emptyValues;
  return {
    fullName: client.fullName || "",
    phone: client.phone || "",
    email: client.email || "",
    dateOfBirth: client.dateOfBirth ? client.dateOfBirth.slice(0, 10) : "",
    clientNumber: client.clientNumber || "",
    address: client.address || "",
    city: client.city || "",
    preferredLanguage: client.preferredLanguage || "",
    preferredContactMethod: client.preferredContactMethod || "",
    occupation: client.occupation || "",
    emergencyContactName: client.emergencyContactName || "",
    emergencyContactPhone: client.emergencyContactPhone || "",
    referralSource: client.referralSource || "",
    generalNotes: client.generalNotes || "",
    tags: client.tags || "",
    status: client.status || "ACTIVE",
    consentReceived: client.consentReceived || false,
    consentDate: client.consentDate ? client.consentDate.slice(0, 10) : "",
    consentMethod: client.consentMethod || "",
    consentFormVersion: client.consentFormVersion || "",
    consentNotes: client.consentNotes || "",
  };
}

interface Props {
  client?: Client | null;
  onSaved: (client: Client) => void;
  onCancel: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

export default function ClientForm({ client, onSaved, onCancel }: Props) {
  const [values, setValues] = useState<ClientFormValues>(() => toFormValues(client));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [duplicatesChecked, setDuplicatesChecked] = useState(false);

  useEffect(() => {
    setValues(toFormValues(client));
  }, [client]);

  function update<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!values.fullName.trim()) errs.fullName = "Full name is required.";
    if (!values.phone.trim()) errs.phone = "Phone number is required.";
    else if (!PHONE_RE.test(values.phone.trim())) errs.phone = "Enter a valid phone number.";
    if (values.email && !EMAIL_RE.test(values.email.trim())) errs.email = "Enter a valid email address.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function checkDuplicates() {
    if (!values.phone && !values.email && !values.clientNumber) return;
    try {
      const res = await api.get("/clients/check-duplicate", {
        params: { phone: values.phone || undefined, email: values.email || undefined, clientNumber: values.clientNumber || undefined, excludeId: client?.id },
      });
      setDuplicates(res.data.duplicates);
      setDuplicatesChecked(true);
    } catch {
      // non-blocking
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    if (!duplicatesChecked) {
      await checkDuplicates();
    }

    setSaving(true);
    try {
      const payload = { ...values, email: values.email || null, dateOfBirth: values.dateOfBirth || null, consentDate: values.consentDate || null };
      const res = client ? await api.put(`/clients/${client.id}`, payload) : await api.post("/clients", payload);
      onSaved(res.data.client);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save client."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ErrorBanner message={error} />

      {duplicates.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Possible duplicate client{duplicates.length > 1 ? "s" : ""} found:</p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.fullName} — {d.phone} {d.email ? `— ${d.email}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">You can still save if this is a different person.</p>
        </div>
      )}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold text-gray-900">Basic information</legend>
        <Field label="Full name" required error={errors.fullName}>
          <input className="input" value={values.fullName} onChange={(e) => update("fullName", e.target.value)} onBlur={checkDuplicates} required />
        </Field>
        <Field label="Phone number" required error={errors.phone}>
          <input className="input" type="tel" value={values.phone} onChange={(e) => update("phone", e.target.value)} onBlur={checkDuplicates} required />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={values.email} onChange={(e) => update("email", e.target.value)} onBlur={checkDuplicates} />
        </Field>
        <Field label="Date of birth">
          <input className="input" type="date" value={values.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
        </Field>
        <Field label="Client number">
          <input className="input" value={values.clientNumber} onChange={(e) => update("clientNumber", e.target.value)} onBlur={checkDuplicates} />
        </Field>
        <Field label="Status">
          <select className="input" value={values.status} onChange={(e) => update("status", e.target.value)}>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CLIENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Address" full>
          <input className="input" value={values.address} onChange={(e) => update("address", e.target.value)} />
        </Field>
        <Field label="City">
          <input className="input" value={values.city} onChange={(e) => update("city", e.target.value)} />
        </Field>
        <Field label="Preferred language">
          <input className="input" value={values.preferredLanguage} onChange={(e) => update("preferredLanguage", e.target.value)} />
        </Field>
        <Field label="Preferred contact method">
          <select className="input" value={values.preferredContactMethod} onChange={(e) => update("preferredContactMethod", e.target.value)}>
            <option value="">Not specified</option>
            <option value="PHONE">Phone</option>
            <option value="EMAIL">Email</option>
            <option value="MESSAGE">Text / message</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </Field>
        <Field label="Occupation">
          <input className="input" value={values.occupation} onChange={(e) => update("occupation", e.target.value)} />
        </Field>
        <Field label="Referral source">
          <input className="input" value={values.referralSource} onChange={(e) => update("referralSource", e.target.value)} />
        </Field>
        <Field label="Emergency contact name">
          <input className="input" value={values.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} />
        </Field>
        <Field label="Emergency contact phone">
          <input className="input" value={values.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} />
        </Field>
        <Field label="Tags (comma separated)" full>
          <input className="input" value={values.tags} onChange={(e) => update("tags", e.target.value)} placeholder="e.g. twins, tongue-tie" />
        </Field>
        <Field label="General notes" full>
          <textarea className="input" rows={3} value={values.generalNotes} onChange={(e) => update("generalNotes", e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold text-gray-900">Consent</legend>
        <Field label="Consent received">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.consentReceived} onChange={(e) => update("consentReceived", e.target.checked)} />
            Client has provided consent
          </label>
        </Field>
        <Field label="Consent date">
          <input className="input" type="date" value={values.consentDate} onChange={(e) => update("consentDate", e.target.value)} />
        </Field>
        <Field label="Consent method">
          <input className="input" value={values.consentMethod} onChange={(e) => update("consentMethod", e.target.value)} placeholder="e.g. signed form, verbal" />
        </Field>
        <Field label="Consent form version">
          <input className="input" value={values.consentFormVersion} onChange={(e) => update("consentFormVersion", e.target.value)} />
        </Field>
        <Field label="Consent notes" full>
          <textarea className="input" rows={2} value={values.consentNotes} onChange={(e) => update("consentNotes", e.target.value)} />
        </Field>
      </fieldset>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : client ? "Save changes" : "Create client"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, required, error, full }: { label: string; children: React.ReactElement<{ id?: string }>; required?: boolean; error?: string; full?: boolean }) {
  const id = "field-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {cloneElement(children, { id })}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
