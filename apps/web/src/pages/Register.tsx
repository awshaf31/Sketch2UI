import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout.js";
import { Button } from "../components/Button.js";
import { Field } from "../components/Field.js";
import { Input } from "../components/Input.js";
import { PasswordInput } from "../components/PasswordInput.js";
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
      navigate("/app");
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout>
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
          <PasswordInput
            id="register-password"
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
    </AuthSplitLayout>
  );
}
