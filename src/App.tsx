import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { notFoundRoute, routes } from "./lib/routes";

export function App() {
  const [locationPath, setLocationPath] = useState(
    () => `${window.location.pathname}${window.location.search}`
  );
  const path = new URL(locationPath, window.location.origin).pathname;

  const activeRoute = useMemo(() => {
    return routes.find((route) => route.path === path) ?? notFoundRoute;
  }, [path]);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", nextPath);
    const nextUrl = new URL(nextPath, window.location.origin);
    setLocationPath(`${nextUrl.pathname}${nextUrl.search}`);
  }

  useEffect(() => {
    const handlePopState = () => setLocationPath(`${window.location.pathname}${window.location.search}`);

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title = `${activeRoute.title} | Vibehall`;
  }, [activeRoute.title]);

  return <AppShell activeRoute={activeRoute} onNavigate={navigate} routes={routes} />;
}