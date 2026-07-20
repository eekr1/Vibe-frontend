import { Component, type ErrorInfo, type ReactNode } from "react";

import { PageError } from "./feedback";
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
          <PageError
            action={<div className="action-row">
              <Button onClick={() => window.location.reload()} size="small" variant="primary">
                Refresh page
              </Button>
              <Button onClick={() => window.location.assign("/")} size="small">
                Go home
              </Button>
            </div>}
            description="This page stopped rendering safely. Refresh it once, or return to the hall."
            title="Vibehall needs a fresh start for this page."
          />
        </main>
      );
    }

    return this.props.children;
  }
}
