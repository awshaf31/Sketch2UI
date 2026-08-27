import { forwardRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "./cn.js";
import { Input } from "./Input.js";
import { IconButton } from "./IconButton.js";

// Design audit 2026-08-26: Login and Register are the only two password fields in the app —
// a small shared wrapper here beats duplicating the show/hide toggle in both pages.

function EyeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <circle cx="8" cy="8" r="2" />
      <path d="M2 14 14 2" />
    </svg>
  );
}

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  invalid?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, ...rest },
  ref
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-7", className)} {...rest} />
      <IconButton
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        size="sm"
        className="absolute right-0 top-0"
        onClick={() => setVisible((v) => !v)}
        icon={visible ? <EyeOffIcon /> : <EyeIcon />}
      />
    </div>
  );
});
