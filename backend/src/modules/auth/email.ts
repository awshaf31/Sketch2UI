import { Resend } from "resend";
import { env } from "../../config/env.js";

// Forgot-password email delivery. RESEND_API_KEY is optional in local dev — without
// it, the reset link is logged to the console instead of sent, so the flow stays
// testable before a Resend account exists (see docs on env.resendApiKey).
let client: Resend | null = null;
function getClient(): Resend {
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!env.resendApiKey) {
    console.log(`[email:dev] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  const { error } = await getClient().emails.send({
    from: env.emailFrom,
    to,
    subject: "Reset your Sketch2UI password",
    html:
      `<p>Someone requested a password reset for this email address on Sketch2UI.</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    text: `Reset your Sketch2UI password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
  });
  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}
