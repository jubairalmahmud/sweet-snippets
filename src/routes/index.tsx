// @ts-nocheck
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, Component, ReactNode } from "react";

const App = lazy(() => import("@/sk-love/App"));

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("AppErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white font-sans text-center">
          <div className="max-w-md rounded-3xl border border-rose-500/30 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-2xl text-rose-400">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-white">SK Love Reconnecting...</h2>
            <p className="mt-1 text-xs text-slate-300">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg active:scale-95 transition"
              >
                Refresh App
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Page() {
  return (
    <AppErrorBoundary>
      <ClientOnly fallback={null}>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-white font-sans text-sm">Loading SK Love...</div>}>
          <App />
        </Suspense>
      </ClientOnly>
    </AppErrorBoundary>
  );
}

export const Route = createFileRoute("/")({
  component: Page,
});

