import { Component, type ErrorInfo, type ReactNode } from "react";

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
        <main className="error-screen">
          <p className="eyebrow">Something broke</p>
          <h1>Vibehall hit a client-side error.</h1>
          <p>
            Refresh the page once. If it happens again, keep the current route and console message
            for debugging.
          </p>
          <p className="form-error">{this.state.error.message}</p>
        </main>
      );
    }

    return this.props.children;
  }
}
