import { Link } from "react-router-dom";
import type { ComponentProps } from "react";
import { BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from "./Button.js";
import type { ButtonSize, ButtonVariant } from "./Button.js";
import { cn } from "./cn.js";

// A `<Link>` styled identically to Button — for the marketing site's CTAs, which must
// be real navigable anchors (SEO, "open in new tab", no-JS fallback), not a <button
// onClick={navigate(...)}>. Reuses Button's own class recipe (BUTTON_SIZE_CLASSES /
// BUTTON_VARIANT_CLASSES) so the two can never visually drift apart. Does not support
// variant="tinted" — none of the marketing CTAs need it.

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Exclude<ButtonVariant, "tinted">;
  size?: ButtonSize;
}

export function LinkButton({ variant = "secondary", size = "md", className, ...rest }: LinkButtonProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-sm font-sans font-medium transition-colors duration-fast",
        BUTTON_SIZE_CLASSES[size],
        BUTTON_VARIANT_CLASSES[variant],
        className
      )}
      {...rest}
    />
  );
}
