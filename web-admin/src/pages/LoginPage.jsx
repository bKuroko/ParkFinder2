import { useState } from "react";
import { CarFront, LockKeyhole, ShieldCheck } from "lucide-react";

import { login, registerAdmin } from "../api/client";

function errorText(error) {
  try {
    return JSON.parse(error.message).detail || error.message;
  } catch {
    return error.message || "Unable to complete the request.";
  }
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("The passwords do not match.");
          return;
        }
        const result = await registerAdmin({ full_name: fullName, email, password });
        setEmail(result.email || email.trim().toLowerCase());
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        setMode("login");
        setSuccess("Registration submitted. You can sign in after the super admin approves your account.");
      } else {
        await login(email, password);
        onLogin();
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-aside">
          <span className="brand-icon">
            <CarFront size={28} />
          </span>
          <div>
            <p className="eyebrow">
              <ShieldCheck size={15} />
              Secure management access
            </p>
            <h1>ParkFinder Manager</h1>
            <p>Manage parking facilities and monitor available and occupied slot counts.</p>
          </div>
        </div>

        <form className="login-panel" onSubmit={handleSubmit}>
          <div className="login-heading">
            <span>
              <LockKeyhole size={18} />
            </span>
            <div>
              <h2>{mode === "login" ? "Sign in" : "Parking manager registration"}</h2>
              <p>{mode === "login" ? "Use your parking manager or super-admin account." : "Create a parking manager account for super-admin review."}</p>
            </div>
          </div>

          {mode === "register" ? (
            <label>
              Full name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={160} autoComplete="name" required />
            </label>
          ) : null}
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={255} autoComplete="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={mode === "register" ? 8 : undefined} maxLength={mode === "register" ? 72 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </label>
          {mode === "register" ? (
            <label>
              Confirm password
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
            </label>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
          {success ? <p className="success-text">{success}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Submit Registration"}
          </button>
          <p className="login-switch">
            {mode === "login" ? "Parking owner?" : "Already registered?"}{" "}
            <button className="login-mode-toggle" type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
