import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { routes } from "./lib/routes";

export function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  const activeRoute = useMemo(() => {
    return routes.find((route) => route.path === path) ?? routes[0];
  }, [path]);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", nextPath);
    setPath(new URL(nextPath, window.location.origin).pathname);
  }

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return <AppShell activeRoute={activeRoute} onNavigate={navigate} routes={routes} />;
}
