"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Mode = "login" | "register" | "recover";

export default function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [mounted, setMounted] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuedCode, setIssuedCode] = useState("");
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(false);
  const [registrationAcknowledged, setRegistrationAcknowledged] = useState(false);
  const [enteringVault, setEnteringVault] = useState(false);
  const [demoEntry, setDemoEntry] = useState(false);
  const [errorCycle, setErrorCycle] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => setMounted(true), []);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function showError(value: string) {
    setError(value);
    setErrorCycle((current) => current + 1);
  }

  function enterVault() {
    setEnteringVault(true);
    window.setTimeout(() => window.location.assign("/vault"), 1950);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    // Registration credentials stay in the form. No account-creation request
    // is sent until the user explicitly accepts the separate responsibility notice.
    if (mode === "register" && !registrationAcknowledged) {
      setShowRegistrationNotice(true);
      return;
    }

    setBusy(true);
    clearFeedback();
    if (!requiresAcknowledgement) setIssuedCode("");

    // Empty credentials open a read-only UI preview only. This never creates
    // an auth session and never grants access to real Vault records or APIs.
    if (mode === "login" && !loginId.trim() && !password) {
      setDemoEntry(true);
      setEnteringVault(true);
      window.setTimeout(() => window.location.assign("/vault-preview"), 850);
      setBusy(false);
      return;
    }

    const endpoint = mode === "register" ? "/api/auth/register" : mode === "recover" ? "/api/auth/recovery" : "/api/auth/login";
    const payload = mode === "register"
      ? { loginId, password, responsibilityAccepted: registrationAcknowledged }
      : mode === "recover"
        ? { loginId, recoveryCode, newPassword }
        : { loginId, password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed.");

      if (data.recoveryCode) {
        setIssuedCode(data.recoveryCode);
        setRequiresAcknowledgement(Boolean(data.requiresAcknowledgement));
        if (mode === "recover") {
          setMessage(data.signedIn === false
            ? "Your password was updated and the new code is pending. Sign in with your new Master Password to retrieve the same code."
            : "Your Master Password is updated. Save this new Recovery Code, then confirm below.");
        } else if (mode === "register") {
          setMessage(data.signedIn === false
            ? "Vault account created. Save this Recovery Code. Sign in afterward to retrieve it again if this response is lost."
            : "Vault account created. Save this Recovery Code before continuing.");
        } else {
          setMessage("An unconfirmed Recovery Code was found. Save it safely, then confirm below.");
        }
      } else if (mode === "login") {
        enterVault();
        return;
      } else {
        setMessage("Password reset. You can now sign in with your new Master Password.");
        setMode("login");
        setPassword("");
        setNewPassword("");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function acceptRegistrationNotice() {
    setRegistrationAcknowledged(true);
    setShowRegistrationNotice(false);
    // Let React commit the acknowledgement state before re-submitting the form.
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  function cancelRegistrationNotice() {
    setShowRegistrationNotice(false);
    setRegistrationAcknowledged(false);
  }

  async function acknowledgeSavedCode() {
    if (busy) return;
    setBusy(true);
    clearFeedback();
    try {
      const response = await fetch("/api/auth/recovery/acknowledge", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not confirm saved code.");
      setRequiresAcknowledgement(false);
      setIssuedCode("");
      enterVault();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not confirm saved code.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(issuedCode);
      setMessage("Recovery Code copied. Store it somewhere safe before confirming.");
    } catch {
      setMessage("Copy was blocked by this browser. Select and copy the Recovery Code manually before confirming.");
    }
  }

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Create your Vault" : "Recover access";
  const description = mode === "login" ? "Your secure space is one step away." : mode === "register" ? "Set up your private access credentials." : "Use your saved Recovery Code to continue.";

  return (
    <div id="create-vault" className={`auth-card${busy ? " is-busy" : ""}`}>
      <div className="auth-card-heading">
        <div>
          <span className="auth-card-overline">PRIVATE ACCESS PORTAL</span>
          <h2 key={mode} className="auth-heading-enter">{title}</h2>
          <p>{description}</p>
        </div>
        <span className={`auth-card-mark${busy ? " is-processing" : ""}`} aria-hidden="true"><i /><i /><i /></span>
      </div>

      <div className="tabs" role="tablist" aria-label="Vault authentication">
        <button type="button" role="tab" aria-selected={mode === "login"} disabled={requiresAcknowledgement || busy} className={mode === "login" ? "tab active" : "tab"} onClick={() => { setMode("login"); setRegistrationAcknowledged(false); setShowRegistrationNotice(false); clearFeedback(); setIssuedCode(""); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === "register"} disabled={requiresAcknowledgement || busy} className={mode === "register" ? "tab active" : "tab"} onClick={() => { setMode("register"); setRegistrationAcknowledged(false); setShowRegistrationNotice(false); clearFeedback(); setIssuedCode(""); }}>Create Vault</button>
        <button type="button" role="tab" aria-selected={mode === "recover"} disabled={requiresAcknowledgement || busy} className={mode === "recover" ? "tab active" : "tab"} onClick={() => { setMode("recover"); setRegistrationAcknowledged(false); setShowRegistrationNotice(false); clearFeedback(); setIssuedCode(""); }}>Recover</button>
      </div>

      {!requiresAcknowledgement && (
        <form ref={formRef} onSubmit={submit} className="auth-form" aria-busy={busy}>
          <label htmlFor="login-id">Vault Login ID</label>
          <input id="login-id" autoComplete="username" value={loginId} onChange={e => { setLoginId(e.target.value); if (error) setError(""); }} minLength={4} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{3,31}" required={mode !== "login"} placeholder="Your private login ID" aria-invalid={Boolean(error)} />
          {mode !== "recover" ? (
            <>
              <label htmlFor="master-password">Master Password</label>
              <div className="password-field">
                <input id="master-password" type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={e => { setPassword(e.target.value); if (error) setError(""); }} minLength={12} maxLength={128} required={mode !== "login"} placeholder="Enter your Master Password" aria-invalid={Boolean(error)} />
                <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide Master Password" : "Show Master Password"} aria-pressed={showPassword} aria-controls="master-password">{showPassword ? "HIDE" : "SHOW"}</button>
              </div>
              <div className={password.length ? "password-activity is-active" : "password-activity"} aria-live="polite">
                <span className="password-activity-bars" aria-hidden="true"><i /><i /><i /><i /></span>
                <span>{password.length ? "INPUT RESPONSE ACTIVE" : "TYPE TO EXPLORE THE INTERFACE"}</span>
                <small>Text stays in this form until you choose to sign in.</small>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="recovery-code">Recovery Code</label>
              <input id="recovery-code" autoComplete="off" value={recoveryCode} onChange={e => { setRecoveryCode(e.target.value); if (error) setError(""); }} required placeholder="Enter your saved Recovery Code" aria-invalid={Boolean(error)} />
              <label htmlFor="new-password">New Master Password</label>
              <div className="password-field">
                <input id="new-password" type={showNewPassword ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={e => { setNewPassword(e.target.value); if (error) setError(""); }} minLength={12} maxLength={128} required placeholder="At least 12 characters" aria-invalid={Boolean(error)} />
                <button className="password-toggle" type="button" onClick={() => setShowNewPassword(value => !value)} aria-label={showNewPassword ? "Hide new Master Password" : "Show new Master Password"} aria-pressed={showNewPassword} aria-controls="new-password">{showNewPassword ? "HIDE" : "SHOW"}</button>
              </div>
            </>
          )}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? <><span className="button-spinner" aria-hidden="true" />{mode === "login" ? "Verifying access…" : mode === "register" ? "Creating secure Vault…" : "Recovering access…"}</> : mode === "register" ? "Create secure Vault" : mode === "recover" ? "Reset Master Password" : "Sign in securely"}
          </button>
          {busy && <p className="auth-processing-note" role="status">Securely processing your request. Please keep this page open.</p>}
        </form>
      )}

      {error && <div key={errorCycle} className="feedback error auth-feedback-enter" role="alert"><span className="feedback-icon" aria-hidden="true">!</span><span>{error}</span></div>}
      {message && <div className="feedback success auth-feedback-enter" role="status"><span className="feedback-icon" aria-hidden="true">✓</span><span>{message}</span></div>}

      {issuedCode && (
        <div className="recovery-box auth-panel-enter">
          <strong>Your Recovery Code</strong>
          <code>{issuedCode}</code>
          <p>Save it offline in a secure place separate from this device. Do not close this screen until you have stored it safely.</p>
          <button type="button" className="secondary-button" onClick={copyCode}>Copy Recovery Code</button>
          {requiresAcknowledgement && <button type="button" className="primary-button" disabled={busy} onClick={acknowledgeSavedCode}>{busy ? <><span className="button-spinner" aria-hidden="true" />Confirming…</> : "I have safely saved this code"}</button>}
        </div>
      )}
      <p className="auth-footnote">Your Vault Login ID and Master Password are used only to access this private vault.</p>

      {showRegistrationNotice && mounted && createPortal(
        <div className="registration-notice-backdrop" role="presentation">
          <section className="registration-notice" role="dialog" aria-modal="true" aria-labelledby="registration-notice-title" aria-describedby="registration-notice-description">
            <div className="registration-notice-topline"><span>BEFORE YOU CREATE YOUR VAULT</span><span className="registration-notice-mark" aria-hidden="true">!</span></div>
            <h2 id="registration-notice-title">Your Vault. Your responsibility.</h2>
            <p id="registration-notice-description" className="registration-notice-intro">Please review these points before creating your account. Your credentials have not been submitted.</p>
            <div className="registration-notice-content">
              <article><b>01</b><div><strong>Your choice, your data</strong><p>Storing account names, passwords, backup codes, or other sensitive information is entirely your choice. You decide what to place in your Vault.</p></div></article>
              <article><b>02</b><div><strong>Protect your access</strong><p>You are responsible for safeguarding your device, Login ID, Master Password, and any Vault recovery information. Keep recovery material somewhere safe and separate.</p></div></article>
              <article><b>03</b><div><strong>Recovery may not be possible</strong><p>If you lose the required unlock or recovery information, your stored records may become permanently inaccessible. Do not assume support or the Owner can restore them.</p></div></article>
              <article><b>04</b><div><strong>Understand the current security status</strong><p>Security testing has defined limits. No system is risk-free. The public Security page explains which protections are implemented, which remain unverified, and what should not yet be stored.</p><a href="/security" target="_blank" rel="noreferrer">Review Security &amp; Transparency ↗</a></div></article>
            </div>
            <p className="registration-notice-final">By choosing “I understand &amp; create account”, you confirm that you have read this notice and choose to proceed. This acknowledgement does not change the technical security status or remove rights that cannot lawfully be waived.</p>
            <div className="registration-notice-actions">
              <button type="button" className="secondary-button" onClick={cancelRegistrationNotice}>Go back</button>
              <button type="button" className="primary-button" onClick={acceptRegistrationNotice}>I understand &amp; create account</button>
            </div>
          </section>
        </div>,
        document.body
      )}

      {enteringVault && (
        <div className="vault-entry-transition" role="status" aria-live="assertive">
          <div className="vault-entry-orbit" aria-hidden="true"><span /><span /><span /><b>V</b></div>
          <strong>{demoEntry ? "DEMO PREVIEW" : "ACCESS VERIFIED"}</strong>
          <p>{demoEntry ? "Opening a read-only sample Vault…" : "Opening your private Vault…"}</p>
          <div className="vault-entry-progress" aria-hidden="true"><i /></div>
        </div>
      )}
    </div>
  );
}
