import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

// Google Identity Services (GIS) — the client-side half of Google Sign-In (blueprint:
// no server-side OAuth redirect/callback, no client secret). The script hands this
// button a signed ID token on success; backend/src/modules/auth/auth.routes.ts's
// POST /google is the only place that token is verified.
//
// VITE_GOOGLE_CLIENT_ID is optional on purpose: until it's set (a Google Cloud OAuth client
// has to be created first — see .env.example), this component renders nothing rather than
// erroring, so Login/Register keep working today.

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: { theme: string; size: string; width: number; text: string }): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let scriptLoadPromise: Promise<void> | null = null;
function loadGisScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export function GoogleSignInButton() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadGisScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            loginWithGoogle(response.credential)
              .then(() => navigate("/app"))
              .catch((e) => setError((e as Error).message));
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
        });
      })
      .catch((e) => setError((e as Error).message));

    return () => {
      cancelled = true;
    };
  }, [clientId, loginWithGoogle, navigate]);

  if (!clientId) return null;

  return (
    <div>
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="mt-sm text-sm text-error">{error}</p>}
    </div>
  );
}
