import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../api/client";
import { ErrorBanner } from "../components/ui";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setSent(true);
      setDevToken(res.data.devResetToken || null);
    } catch (err) {
      setError(apiErrorMessage(err, t("auth.resetRequestFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-brand-700">{t("auth.resetPasswordTitle")}</h1>
        <div className="card space-y-4">
          <ErrorBanner message={error} />
          {sent ? (
            <div className="space-y-3 text-sm text-gray-700">
              <p>{t("auth.resetGenericMessage")}</p>
              {devToken && (
                <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="mb-1 font-medium">{t("auth.noEmailProviderWarning")}</p>
                  <Link className="break-all font-medium text-brand-700 underline" to={`/reset-password?token=${devToken}`}>
                    {t("auth.resetPasswordLink")}
                  </Link>
                </div>
              )}
              <Link to="/login" className="block font-medium text-brand-700 hover:underline">
                {t("auth.backToSignIn")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">{t("auth.resetPasswordSubtitle")}</p>
              <div>
                <label className="label" htmlFor="email">
                  {t("auth.email")}
                </label>
                <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t("auth.sending") : t("auth.sendResetInstructions")}
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
