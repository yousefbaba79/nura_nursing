import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage, setToken } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner } from "../components/ui";

export default function Setup() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/setup", { fullName, email, password });
      setToken(res.data.token, true);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not complete setup."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-brand-700">Welcome to Nura Lactation</h1>
        <p className="mb-6 text-center text-sm text-gray-500">Create your consultant account to get started.</p>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <ErrorBanner message={error} />
          <div>
            <label className="label" htmlFor="fullName">
              Full name
            </label>
            <input id="fullName" required className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
