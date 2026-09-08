import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../api/client";
import { ErrorBanner } from "../components/ui";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [token, setToken] = useState(params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(apiErrorMessage(err, t("auth.resetFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-brand-700">{t("auth.chooseNewPassword")}</h1>
        <div className="card space-y-4">
          <ErrorBanner message={error} />
          {done ? (
            <p className="text-sm text-gray-700">{t("auth.resetSuccess")}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="token">
                  {t("auth.resetToken")}
                </label>
                <input id="token" required className="input" value={token} onChange={(e) => setToken(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="newPassword">
                  {t("auth.newPassword")}
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t("common.saving") : t("auth.resetPasswordButton")}
              </button>
              <Link to="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
                {t("auth.backToSignIn")}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
