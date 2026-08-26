import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { BrandMark } from "../components/BrandMark.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { Field } from "../components/Field.js";
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
    <div className="flex min-h-full flex-col bg-bg">
      <AppHeader />
      <div
        className="flex flex-1 items-center justify-center px-lg py-3xl"
        // Inline gradient because Tailwind's arbitrary-value syntax can't reference a
        // theme color by name here — #e9eefc is exactly the `primary-subtle` token
        // from tailwind.config.js, just spelled out since this is a raw CSS value.
        style={{ backgroundImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #e9eefc, transparent)" }}
      >
        <div className="w-full max-w-[400px]">
          <Link
            to="/"
            className="mb-lg flex items-center justify-center gap-xs text-text-primary transition-colors duration-fast hover:text-primary"
          >
            <BrandMark className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold">Sketch2UI</span>
          </Link>
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
                <PasswordInput
                  id="login-password"
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
    </div>
  );
}
