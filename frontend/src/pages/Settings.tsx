import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner, ConfirmDialog } from "../components/ui";
import i18n, { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from "../i18n";

export default function Settings() {
  const { consultant, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [fullName, setFullName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState<SupportedLanguage>("en");
  const [timeZone, setTimeZone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [defaultVisitDurationMinutes, setDefaultVisitDurationMinutes] = useState(60);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [deactivateConfirm, setDeactivateConfirm] = useState(false);

  useEffect(() => {
    if (!consultant) return;
    setFullName(consultant.fullName || "");
    setProfessionalTitle(consultant.professionalTitle || "");
    setPhone(consultant.phone || "");
    setClinicName(consultant.clinicName || "");
    setClinicAddress(consultant.clinicAddress || "");
    setDefaultLanguage((consultant.defaultLanguage as SupportedLanguage) || "en");
    setTimeZone(consultant.timeZone || "UTC");
    setDateFormat(consultant.dateFormat || "MM/DD/YYYY");
    setDefaultVisitDurationMinutes(consultant.defaultVisitDurationMinutes || 60);
    setSessionTimeoutMinutes(consultant.sessionTimeoutMinutes || 30);
  }, [consultant]);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await api.put("/settings/profile", {
        fullName,
        professionalTitle: professionalTitle || null,
        phone: phone || null,
        clinicName: clinicName || null,
        clinicAddress: clinicAddress || null,
        defaultLanguage,
        timeZone,
        dateFormat,
        defaultVisitDurationMinutes: Number(defaultVisitDurationMinutes),
        sessionTimeoutMinutes: Number(sessionTimeoutMinutes),
      });
      await refresh();
      // refresh() may switch the active UI language (defaultLanguage changed);
      // use the live i18n instance rather than the pre-switch `t` closure so
      // this message matches the language now shown on the rest of the page.
      setProfileMessage(i18n.t("settings.profileUpdated"));
    } catch (err) {
      setProfileError(apiErrorMessage(err, t("settings.couldNotUpdateProfile")));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage("");
    setPasswordError("");
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setPasswordMessage(t("settings.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(apiErrorMessage(err, t("settings.couldNotChangePassword")));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeactivate() {
    await api.post("/settings/deactivate");
    await logout();
    navigate("/login", { replace: true });
  }

  function exportCsv() {
    window.open(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/reports/clients.csv`, "_blank");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{t("settings.title")}</h1>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">{t("settings.profileClinic")}</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {profileMessage && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{profileMessage}</p>}
          <ErrorBanner message={profileError} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="s-fullname">{t("settings.fullName")}</label>
              <input id="s-fullname" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="s-title">{t("settings.professionalTitle")}</label>
              <input id="s-title" className="input" value={professionalTitle} onChange={(e) => setProfessionalTitle(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-phone">{t("settings.phoneNumber")}</label>
              <input id="s-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-email">{t("settings.email")}</label>
              <input id="s-email" className="input bg-gray-50" value={consultant?.email || ""} disabled />
            </div>
            <div>
              <label className="label" htmlFor="s-clinic-name">{t("settings.clinicName")}</label>
              <input id="s-clinic-name" className="input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-clinic-address">{t("settings.clinicAddress")}</label>
              <input id="s-clinic-address" className="input" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-language">{t("settings.defaultLanguage")}</label>
              <select id="s-language" className="input" value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value as SupportedLanguage)}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {LANGUAGE_LABELS[lang]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-timezone">{t("settings.timeZone")}</label>
              <input id="s-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-date-format">{t("settings.dateFormat")}</label>
              <select id="s-date-format" className="input" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-visit-duration">{t("settings.defaultVisitDuration")}</label>
              <input
                id="s-visit-duration"
                className="input"
                type="number"
                value={defaultVisitDurationMinutes}
                onChange={(e) => setDefaultVisitDurationMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label" htmlFor="s-session-timeout">{t("settings.sessionTimeout")}</label>
              <input id="s-session-timeout" className="input" type="number" min={5} value={sessionTimeoutMinutes} onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={profileSaving}>
            {profileSaving ? t("common.saving") : t("settings.saveProfile")}
          </button>
        </form>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">{t("settings.changePassword")}</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordMessage && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{passwordMessage}</p>}
          <ErrorBanner message={passwordError} />
          <div>
            <label className="label" htmlFor="s-current-password">{t("settings.currentPassword")}</label>
            <input id="s-current-password" className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="s-new-password">{t("settings.newPassword")}</label>
            <input id="s-new-password" className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={passwordSaving}>
            {passwordSaving ? t("common.saving") : t("settings.changePassword")}
          </button>
        </form>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">{t("settings.dataRecords")}</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={exportCsv}>
            {t("settings.exportClientsCsv")}
          </button>
          <Link className="btn-secondary" to="/reports">
            {t("settings.viewReports")}
          </Link>
          <Link className="btn-secondary" to="/settings/audit-log">
            {t("settings.viewAuditLog")}
          </Link>
        </div>
      </div>

      <div className="card space-y-3 border-red-200">
        <h2 className="text-sm font-semibold text-red-700">{t("settings.dangerZone")}</h2>
        <p className="text-sm text-gray-600">{t("settings.deactivateWarning")}</p>
        <button className="btn-danger" onClick={() => setDeactivateConfirm(true)}>
          {t("settings.deactivateAccount")}
        </button>
      </div>

      <ConfirmDialog
        open={deactivateConfirm}
        title={t("settings.deactivateConfirmTitle")}
        description={t("settings.deactivateConfirmDescription")}
        confirmLabel={t("settings.deactivateConfirmLabel")}
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirm(false)}
      />
    </div>
  );
}
