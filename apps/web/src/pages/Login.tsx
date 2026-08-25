import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { Field } from "../components/Field.js";
import { Input } from "../components/Input.js";
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
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-bg">
      <AppHeader />
      <div className="mx-auto max-w-[400px] px-lg pt-3xl">
        <Card>
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
            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </Field>
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
          <p className="mt-lg text-sm text-text-secondary">
            No account?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
