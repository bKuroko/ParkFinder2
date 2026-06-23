import { useEffect, useState } from "react";

import { getToken, removeToken } from "./api/client";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()));

  useEffect(() => {
    setAuthenticated(Boolean(getToken()));
  }, []);

  function handleLogout() {
    removeToken();
    setAuthenticated(false);
  }

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />;
  }

  return <DashboardPage onLogout={handleLogout} />;
}
