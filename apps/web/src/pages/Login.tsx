import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout.js";
import { Button } from "../components/Button.js";
import { Field } from "../components/Field.js";
import { GoogleSignInButton } from "../components/GoogleSignInButton.js";
import { Input } from "../components/Input.js";
import { PasswordInput } from "../components/PasswordInput.js";
import { useAuth } from "../context/AuthContext.js";

// Same shape as Dashboard's create-project form: Field/Input/Button primitives,
// inline <p className="text-error"> for a failed submit (Dashboard.tsx's createError
// pattern) — no new UI primitives invented for auth.

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/app");
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-lg font-semibold text-text-primary">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-lg flex flex-col gap-md">
        <Field label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </Field>
        <div className="flex flex-col gap-xs">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-xs text-text-secondary">
              Password
            </label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!email || !password}
          loading={submitting}
          loadingLabel="Logging in…"
        >
          Log in
        </Button>
      </form>
      <div className="my-lg flex items-center gap-sm text-2xs uppercase tracking-wide text-text-muted">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleSignInButton />
      <p className="mt-lg text-sm text-text-secondary">
        No account?{" "}
        <Link to="/register" className="text-primary hover:underline">
          Register
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
