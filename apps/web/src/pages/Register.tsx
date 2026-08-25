import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { Field } from "../components/Field.js";
import { Input } from "../components/Input.js";
import { useAuth } from "../context/AuthContext.js";

const MIN_PASSWORD_LENGTH = 8;

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await register(email, password);
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
          <h1 className="text-lg font-semibold text-text-primary">Create an account</h1>
          <form onSubmit={handleSubmit} className="mt-lg flex flex-col gap-md">
            <Field label="Email" htmlFor="register-email">
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </Field>
            <Field label="Password" htmlFor="register-password" helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
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
              disabled={!email || password.length < MIN_PASSWORD_LENGTH}
              loading={submitting}
              loadingLabel="Creating account…"
            >
              Create account
            </Button>
          </form>
          <p className="mt-lg text-sm text-text-secondary">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
