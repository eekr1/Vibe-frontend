import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "./ui";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[vibehall:frontend:error-boundary]", {
      error,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="error-screen product-error-screen">
          <div className="product-error-panel">
            <p className="eyebrow">Recovery</p>
            <h1>Vibehall needs a fresh start for this page.</h1>
            <p>
              The room, account, or page view stopped rendering cleanly. Refresh once to reconnect to the app;
              development details stay in the console for debugging.
            </p>
            <div className="action-row">
              <Button onClick={() => window.location.reload()} size="small" variant="primary">
                Refresh page
              </Button>
              <Button onClick={() => window.location.assign("/")} size="small">
                Go home
              </Button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
