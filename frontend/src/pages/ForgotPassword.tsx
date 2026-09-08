import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { ErrorBanner } from "../components/ui";

export default function ForgotPassword() {
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
      setError(apiErrorMessage(err, "Could not process your request."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-brand-700">Reset your password</h1>
        <div className="card space-y-4">
          <ErrorBanner message={error} />
          {sent ? (
            <div className="space-y-3 text-sm text-gray-700">
              <p>If an account exists for that email, password reset instructions have been generated.</p>
              {devToken && (
                <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="mb-1 font-medium">No email service is configured in this environment. Use this link to continue:</p>
                  <Link className="break-all font-medium text-brand-700 underline" to={`/reset-password?token=${devToken}`}>
                    Reset password
                  </Link>
                </div>
              )}
              <Link to="/login" className="block font-medium text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">Enter your account email and we'll generate password reset instructions.</p>
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Sending…" : "Send reset instructions"}
              </button>
              <Link to="/login" className="block text-center text-sm font-medium text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
