"use client";

import { useState } from "react";

type Mode = "login" | "register" | "recover";

export default function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuedCode, setIssuedCode] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage(""); setIssuedCode("");
    const endpoint = mode === "register" ? "/api/auth/register" : mode === "recover" ? "/api/auth/recovery" : "/api/auth/login";
    const payload = mode === "register"
      ? { loginId, password }
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
        setMessage(mode === "recover" ? "Password reset. A new one-time Recovery Code has been issued." : "Vault account created. Save this Recovery Code before continuing.");
      } else if (mode === "login") {
        window.location.assign("/vault");
        return;
      } else {
        setMessage("Password reset. You can now sign in with your new Master Password.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="tabs" role="tablist" aria-label="Vault authentication">
        <button type="button" className={mode === "login" ? "tab active" : "tab"} onClick={() => { setMode("login"); setError(""); setMessage(""); setIssuedCode(""); }}>Sign in</button>
        <button type="button" className={mode === "register" ? "tab active" : "tab"} onClick={() => { setMode("register"); setError(""); setMessage(""); setIssuedCode(""); }}>Create Vault</button>
        <button type="button" className={mode === "recover" ? "tab active" : "tab"} onClick={() => { setMode("recover"); setError(""); setMessage(""); setIssuedCode(""); }}>Recover</button>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="login-id">Vault Login ID</label>
        <input id="login-id" autoComplete="username" value={loginId} onChange={e => setLoginId(e.target.value)} minLength={4} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{3,31}" required placeholder="Your private login ID" />
        {mode !== "recover" ? <>
          <label htmlFor="master-password">Master Password</label>
          <input id="master-password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={128} required placeholder="At least 12 characters" />
        </> : <>
          <label htmlFor="recovery-code">Recovery Code</label>
          <input id="recovery-code" autoComplete="off" value={recoveryCode} onChange={e => setRecoveryCode(e.target.value)} required placeholder="Enter your saved Recovery Code" />
          <label htmlFor="new-password">New Master Password</label>
          <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={12} maxLength={128} required placeholder="At least 12 characters" />
        </>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create secure Vault" : mode === "recover" ? "Reset Master Password" : "Sign in securely"}</button>
      </form>
      {error && <p className="feedback error" role="alert">{error}</p>}
      {message && <p className="feedback success" role="status">{message}</p>}
      {issuedCode && <div className="recovery-box">
        <strong>Your Recovery Code</strong>
        <code>{issuedCode}</code>
        <p>Save it offline in a secure place separate from this device. It is shown only once. Anyone with this code and your Login ID can reset your Vault password.</p>
        <button type="button" className="secondary-button" onClick={() => navigator.clipboard.writeText(issuedCode)}>Copy Recovery Code</button>
      </div>}
      <p className="auth-footnote">Your Vault Login ID is independent of Gmail, your phone number, and your SIM card. Google may still require its own verification if a Gmail authorization is revoked or expires.</p>
    </div>
  );
}
