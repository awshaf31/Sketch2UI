import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout.js";
import { Button } from "../components/Button.js";
import { Field } from "../components/Field.js";
import { PasswordInput } from "../components/PasswordInput.js";
import { useToast } from "../components/ToastStack.js";
import { api } from "../services/api.js";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !token || mismatch) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      showToast("success", "Password reset. Log in with your new password.");
      navigate("/login");
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthSplitLayout>
        <h1 className="text-lg font-semibold text-text-primary">Invalid reset link</h1>
        <p className="mt-md text-sm text-text-secondary">
          This password reset link is missing its token. Request a new one below.
        </p>
        <p className="mt-lg text-sm text-text-secondary">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Request a new link
          </Link>
        </p>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-lg font-semibold text-text-primary">Set a new password</h1>
      <form onSubmit={handleSubmit} className="mt-lg flex flex-col gap-md">
        <Field label="New password" htmlFor="reset-password" helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </Field>
        <Field
          label="Confirm password"
          htmlFor="reset-password-confirm"
          errorText={mismatch ? "Passwords don't match." : undefined}
        >
          <PasswordInput
            id="reset-password-confirm"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            invalid={mismatch}
          />
        </Field>
        {error && <p className="text-sm text-error">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={password.length < MIN_PASSWORD_LENGTH || mismatch}
          loading={submitting}
          loadingLabel="Resetting…"
        >
          Reset password
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
