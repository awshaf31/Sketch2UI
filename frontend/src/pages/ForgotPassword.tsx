import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout.js";
import { Button } from "../components/Button.js";
import { Field } from "../components/Field.js";
import { Input } from "../components/Input.js";
import { api } from "../services/api.js";

// Same shape as Login/Register. The confirmation is deliberately generic and shown
// unconditionally on success — backend's /forgot-password route responds identically
// whether or not the account exists, and the frontend must not undo that by branching
// on anything the response doesn't actually say.

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthSplitLayout>
        <h1 className="text-lg font-semibold text-text-primary">Check your email</h1>
        <p className="mt-md text-sm text-text-secondary">
          If an account exists for <span className="font-medium text-text-primary">{email}</span>, we've sent a link
          to reset your password. The link expires in 1 hour.
        </p>
        <p className="mt-lg text-sm text-text-secondary">
          <Link to="/login" className="text-primary hover:underline">
            Back to log in
          </Link>
        </p>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-lg font-semibold text-text-primary">Reset your password</h1>
      <p className="mt-2xs text-sm text-text-secondary">
        Enter your email and we'll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="mt-lg flex flex-col gap-md">
        <Field label="Email" htmlFor="forgot-password-email">
          <Input
            id="forgot-password-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </Field>
        {error && <p className="text-sm text-error">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!email}
          loading={submitting}
          loadingLabel="Sending…"
        >
          Send reset link
        </Button>
      </form>
      <p className="mt-lg text-sm text-text-secondary">
        <Link to="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
