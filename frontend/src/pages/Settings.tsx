import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner, ConfirmDialog } from "../components/ui";

export default function Settings() {
  const { consultant, refresh, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
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
    setDefaultLanguage(consultant.defaultLanguage || "en");
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
      setProfileMessage("Profile updated.");
    } catch (err) {
      setProfileError(apiErrorMessage(err, "Could not update profile."));
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
      setPasswordMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(apiErrorMessage(err, "Could not change password."));
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
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Profile &amp; clinic</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          {profileMessage && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{profileMessage}</p>}
          <ErrorBanner message={profileError} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="s-fullname">Full name</label>
              <input id="s-fullname" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="s-title">Professional title</label>
              <input id="s-title" className="input" value={professionalTitle} onChange={(e) => setProfessionalTitle(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-phone">Phone number</label>
              <input id="s-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-email">Email</label>
              <input id="s-email" className="input bg-gray-50" value={consultant?.email || ""} disabled />
            </div>
            <div>
              <label className="label" htmlFor="s-clinic-name">Clinic name</label>
              <input id="s-clinic-name" className="input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-clinic-address">Clinic address</label>
              <input id="s-clinic-address" className="input" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-language">Default language</label>
              <input id="s-language" className="input" value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-timezone">Time zone</label>
              <input id="s-timezone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-date-format">Date format</label>
              <select id="s-date-format" className="input" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-visit-duration">Default visit duration (minutes)</label>
              <input
                id="s-visit-duration"
                className="input"
                type="number"
                value={defaultVisitDurationMinutes}
                onChange={(e) => setDefaultVisitDurationMinutes(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label" htmlFor="s-session-timeout">Automatic session timeout (minutes)</label>
              <input id="s-session-timeout" className="input" type="number" min={5} value={sessionTimeoutMinutes} onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={profileSaving}>
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </div>

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordMessage && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{passwordMessage}</p>}
          <ErrorBanner message={passwordError} />
          <div>
            <label className="label" htmlFor="s-current-password">Current password</label>
            <input id="s-current-password" className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="s-new-password">New password</label>
            <input id="s-new-password" className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={passwordSaving}>
            {passwordSaving ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Data &amp; records</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={exportCsv}>
            Export clients (CSV)
          </button>
          <Link className="btn-secondary" to="/reports">
            View reports
          </Link>
          <Link className="btn-secondary" to="/settings/audit-log">
            View audit log
          </Link>
        </div>
      </div>

      <div className="card space-y-3 border-red-200">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="text-sm text-gray-600">Deactivating your account will sign you out and disable sign-in. Client records are preserved.</p>
        <button className="btn-danger" onClick={() => setDeactivateConfirm(true)}>
          Deactivate account
        </button>
      </div>

      <ConfirmDialog
        open={deactivateConfirm}
        title="Deactivate your account?"
        description="You will be signed out immediately and will not be able to sign in again until an administrator reactivates your account."
        confirmLabel="Deactivate"
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateConfirm(false)}
      />
    </div>
  );
}
