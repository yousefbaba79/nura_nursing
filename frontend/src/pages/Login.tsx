import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, apiErrorMessage } from "../api/client";
import { ErrorBanner } from "../components/ui";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Login() {
  const { login, consultant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (consultant) navigate("/", { replace: true });
  }, [consultant, navigate]);

  useEffect(() => {
    api
      .get("/auth/setup/status")
      .then((res) => setNeedsSetup(res.data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    if (needsSetup) navigate("/setup", { replace: true });
  }, [needsSetup, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, t("auth.invalidCredentials")));
    } finally {
      setLoading(false);
    }
  }

  const timedOut = (location.state as any)?.reason === "timeout";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold text-brand-700">{t("appName")}</h1>
        <p className="mb-6 text-center text-sm text-gray-500">{t("auth.signInTitle")}</p>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {timedOut && <ErrorBanner message={t("auth.timedOut")} />}
          <ErrorBanner message={error} />
          <div>
            <label className="label" htmlFor="email">
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            <label className="flex items-center gap-2 text-gray-600">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              {t("auth.rememberMe")}
            </label>
            <Link to="/forgot-password" className="font-medium text-brand-700 hover:underline">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}
