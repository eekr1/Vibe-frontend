import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/feedback";
import { LoadingState } from "./components/LoadingState";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Vibehall frontend root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<LoadingState label="Loading Vibehall" />}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);
