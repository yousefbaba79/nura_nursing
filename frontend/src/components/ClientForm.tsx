import { type FormEvent, useEffect, useState, cloneElement } from "react";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../api/client";
import { CLIENT_STATUSES } from "../api/enums";
import { ErrorBanner } from "./ui";
import type { Client } from "../api/types";

export interface ClientFormValues {
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  idNumber: string;
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
  idNumber: "",
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
    idNumber: client.idNumber || "",
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
  const { t } = useTranslation();
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
    if (!values.fullName.trim()) errs.fullName = t("clients.form.errorFullNameRequired");
    if (!values.phone.trim()) errs.phone = t("clients.form.errorPhoneRequired");
    else if (!PHONE_RE.test(values.phone.trim())) errs.phone = t("clients.form.errorPhoneInvalid");
    if (values.email && !EMAIL_RE.test(values.email.trim())) errs.email = t("clients.form.errorEmailInvalid");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function checkDuplicates() {
    if (!values.phone && !values.email && !values.clientNumber && !values.idNumber) return;
    try {
      const res = await api.get("/clients/check-duplicate", {
        params: {
          phone: values.phone || undefined,
          email: values.email || undefined,
          clientNumber: values.clientNumber || undefined,
          idNumber: values.idNumber || undefined,
          excludeId: client?.id,
        },
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
      setError(apiErrorMessage(err, t("clients.form.couldNotSave")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ErrorBanner message={error} />

      {duplicates.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">{duplicates.length > 1 ? t("clients.form.duplicateWarningTitlePlural") : t("clients.form.duplicateWarningTitle")}</p>
          <ul className="mt-1 list-disc ps-5">
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.fullName} — {d.phone} {d.email ? `— ${d.email}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">{t("clients.form.duplicateWarningFooter")}</p>
        </div>
      )}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold text-gray-900">{t("clients.form.basicInformation")}</legend>
        <Field id="client-full-name" label={t("clients.form.fullName")} required error={errors.fullName}>
          <input className="input" value={values.fullName} onChange={(e) => update("fullName", e.target.value)} onBlur={checkDuplicates} required />
        </Field>
        <Field id="client-phone" label={t("clients.form.phoneNumber")} required error={errors.phone}>
          <input className="input" type="tel" value={values.phone} onChange={(e) => update("phone", e.target.value)} onBlur={checkDuplicates} required />
        </Field>
        <Field id="client-id-number" label={t("clients.form.idNumber")}>
          <input className="input" value={values.idNumber} onChange={(e) => update("idNumber", e.target.value)} onBlur={checkDuplicates} />
        </Field>
        <Field id="client-email" label={t("clients.form.email")} error={errors.email}>
          <input className="input" type="email" value={values.email} onChange={(e) => update("email", e.target.value)} onBlur={checkDuplicates} />
        </Field>
        <Field id="client-dob" label={t("clients.form.dateOfBirth")}>
          <input className="input" type="date" value={values.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
        </Field>
        <Field id="client-number" label={t("clients.form.clientNumber")}>
          <input className="input" value={values.clientNumber} onChange={(e) => update("clientNumber", e.target.value)} onBlur={checkDuplicates} />
        </Field>
        <Field id="client-status" label={t("clients.form.status")}>
          <select className="input" value={values.status} onChange={(e) => update("status", e.target.value)}>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`enums.clientStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="client-address" label={t("clients.form.address")} full>
          <input className="input" value={values.address} onChange={(e) => update("address", e.target.value)} />
        </Field>
        <Field id="client-city" label={t("clients.form.city")}>
          <input className="input" value={values.city} onChange={(e) => update("city", e.target.value)} />
        </Field>
        <Field id="client-preferred-language" label={t("clients.form.preferredLanguage")}>
          <input className="input" value={values.preferredLanguage} onChange={(e) => update("preferredLanguage", e.target.value)} />
        </Field>
        <Field id="client-contact-method" label={t("clients.form.preferredContactMethod")}>
          <select className="input" value={values.preferredContactMethod} onChange={(e) => update("preferredContactMethod", e.target.value)}>
            <option value="">{t("clients.form.contactMethodNotSpecified")}</option>
            <option value="PHONE">{t("clients.form.contactMethodPhone")}</option>
            <option value="EMAIL">{t("clients.form.contactMethodEmail")}</option>
            <option value="MESSAGE">{t("clients.form.contactMethodMessage")}</option>
            <option value="WHATSAPP">{t("clients.form.contactMethodWhatsapp")}</option>
          </select>
        </Field>
        <Field id="client-occupation" label={t("clients.form.occupation")}>
          <input className="input" value={values.occupation} onChange={(e) => update("occupation", e.target.value)} />
        </Field>
        <Field id="client-referral-source" label={t("clients.form.referralSource")}>
          <input className="input" value={values.referralSource} onChange={(e) => update("referralSource", e.target.value)} />
        </Field>
        <Field id="client-emergency-name" label={t("clients.form.emergencyContactName")}>
          <input className="input" value={values.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} />
        </Field>
        <Field id="client-emergency-phone" label={t("clients.form.emergencyContactPhone")}>
          <input className="input" value={values.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} />
        </Field>
        <Field id="client-tags" label={t("clients.form.tags")} full>
          <input className="input" value={values.tags} onChange={(e) => update("tags", e.target.value)} placeholder={t("clients.form.tagsPlaceholder")} />
        </Field>
        <Field id="client-notes" label={t("clients.form.generalNotes")} full>
          <textarea className="input" rows={3} value={values.generalNotes} onChange={(e) => update("generalNotes", e.target.value)} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold text-gray-900">{t("clients.form.consentSection")}</legend>
        <Field id="client-consent-received" label={t("clients.form.consentReceived")}>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={values.consentReceived} onChange={(e) => update("consentReceived", e.target.checked)} />
            {t("clients.form.consentReceivedCheckbox")}
          </label>
        </Field>
        <Field id="client-consent-date" label={t("clients.form.consentDate")}>
          <input className="input" type="date" value={values.consentDate} onChange={(e) => update("consentDate", e.target.value)} />
        </Field>
        <Field id="client-consent-method" label={t("clients.form.consentMethod")}>
          <input className="input" value={values.consentMethod} onChange={(e) => update("consentMethod", e.target.value)} placeholder={t("clients.form.consentMethodPlaceholder")} />
        </Field>
        <Field id="client-consent-version" label={t("clients.form.consentFormVersion")}>
          <input className="input" value={values.consentFormVersion} onChange={(e) => update("consentFormVersion", e.target.value)} />
        </Field>
        <Field id="client-consent-notes" label={t("clients.form.consentNotes")} full>
          <textarea className="input" rows={2} value={values.consentNotes} onChange={(e) => update("consentNotes", e.target.value)} />
        </Field>
      </fieldset>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t("common.saving") : client ? t("common.saveChanges") : t("clients.form.createClient")}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  children,
  required,
  error,
  full,
}: {
  id: string;
  label: string;
  children: React.ReactElement<{ id?: string }>;
  required?: boolean;
  error?: string;
  full?: boolean;
}) {
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
