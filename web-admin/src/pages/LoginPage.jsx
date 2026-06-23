import { useState } from "react";
import { CarFront } from "lucide-react";

import { login } from "../api/client";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("admin@parkfinder.local");
  const [password, setPassword] = useState("admin123");
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
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="brand-row">
          <span className="brand-icon">
            <CarFront size={26} />
          </span>
          <div>
            <h1>ParkFinder Admin</h1>
            <p>Facility monitoring dashboard</p>
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
    </main>
  );
}
