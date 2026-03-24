import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] runtime error:", error, info);
  }

  private reloadPage() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-2xl w-full glass rounded-2xl p-6 border border-red-500/30 bg-red-500/5">
          <p className="text-xs uppercase tracking-[0.14em] text-red-300 mb-2">Runtime Error</p>
          <h2 className="text-2xl font-bold text-white mb-2">
            {this.props.fallbackTitle ?? "Dashboard failed to render"}
          </h2>
          <p className="text-sm text-slate-300 mb-4">
            Something crashed on this page. Please reload and try again.
          </p>
          <div className="text-xs text-red-200/90 font-mono mb-5 break-words">
            {this.state.errorMessage || "Unknown error"}
          </div>
          <button
            onClick={() => this.reloadPage()}
            className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-400/30 text-red-100 hover:bg-red-500/30 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </section>
    );
  }
}
