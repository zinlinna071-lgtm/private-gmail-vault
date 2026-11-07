"use client";

import { useState } from "react";

export default function SignOutControl() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        redirect: "follow"
      });
      if (!response.ok || !response.redirected || !new URL(response.url).pathname.startsWith("/")) {
        throw new Error("Could not complete sign out. Please retry.");
      }
      // The server has revoked the session before the visual exit begins.
      window.setTimeout(() => window.location.assign("/"), 1850);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not complete sign out. Please retry.");
    }
  }

  return (
    <>
      <button className="secondary-button signout-button" type="button" onClick={() => void signOut()} disabled={busy}>
        {busy ? <><span className="signout-button-spinner" aria-hidden="true" /> Securing exit…</> : "Sign out"}
      </button>
      {error && <p className="signout-error" role="alert">{error}</p>}
      {busy && (
        <div className="vault-exit-transition" role="status" aria-live="assertive">
          <div className="vault-exit-scene" aria-hidden="true">
            <div className="exit-orbit exit-orbit-one" />
            <div className="exit-orbit exit-orbit-two" />
            <div className="exit-shield"><span>V</span><i /></div>
            <div className="exit-particles"><i /><i /><i /><i /><i /><i /></div>
          </div>
          <strong>SESSION SECURED</strong>
          <p>Your private session has ended.</p>
          <span className="vault-exit-caption">CLOSING ENCRYPTED ACCESS CHANNEL</span>
          <div className="vault-exit-progress"><i /></div>
        </div>
      )}
    </>
  );
}
