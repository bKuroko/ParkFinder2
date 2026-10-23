import { useState } from "react";
import { CarFront, LockKeyhole, ShieldCheck } from "lucide-react";

import { login } from "../api/client";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      onLogin();
    } catch (err) {
      setError("Login failed. Check the admin email and password.");
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
              Secure admin access
            </p>
            <h1>ParkFinder Admin</h1>
            <p>Manage parking facilities and monitor available and occupied slot counts.</p>
          </div>
        </div>

        <form className="login-panel" onSubmit={handleSubmit}>
          <div className="login-heading">
            <span>
              <LockKeyhole size={18} />
            </span>
            <div>
              <h2>Sign in</h2>
              <p>Use your facility admin or super-admin account.</p>
            </div>
          </div>

          <label>
            Admin Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
