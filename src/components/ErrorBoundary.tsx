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
          <p className="eyebrow">Runtime error</p>
          <h1>Vibehall shell needs attention.</h1>
          <p>{this.state.error.message}</p>
        </main>
      );
    }

    return this.props.children;
  }
}
