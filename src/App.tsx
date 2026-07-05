import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { notFoundRoute, routes } from "./lib/routes";

export function App() {
  const [locationPath, setLocationPath] = useState(
    () => `${window.location.pathname}${window.location.search}`
  );
  const path = new URL(locationPath, window.location.origin).pathname;

  const activeRoute = useMemo(() => {
    return routes.find((route) => route.path === path || route.match?.(path)) ?? notFoundRoute;
  }, [path]);

  function navigate(nextPath: string) {
    const navigationEvent = new CustomEvent("vibehall:before-navigate", { cancelable: true, detail: { nextPath } });
    if (!window.dispatchEvent(navigationEvent)) return;
    window.history.pushState({}, "", nextPath);
    const nextUrl = new URL(nextPath, window.location.origin);
    setLocationPath(`${nextUrl.pathname}${nextUrl.search}`);
  }

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      const navigationEvent = new CustomEvent("vibehall:before-navigate", { cancelable: true, detail: { nextPath } });
      if (!window.dispatchEvent(navigationEvent)) {
        window.history.pushState({}, "", locationPath);
        return;
      }
      setLocationPath(nextPath);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [locationPath]);

  useEffect(() => {
    document.title = `${activeRoute.title} | Vibehall`;
  }, [activeRoute.title]);

  return <AppShell activeRoute={activeRoute} onNavigate={navigate} routes={routes} />;
}
