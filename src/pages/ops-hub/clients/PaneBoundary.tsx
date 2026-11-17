import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Every hub page lives in one shell, so one page that throws while rendering would blank the whole app.
 * This keeps the failure inside that page: the sidebar and the other pages keep working, and the page offers a reload.
 */
export class PaneBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[${this.props.name}] page crashed`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 32, fontFamily: "Inter, system-ui, sans-serif", color: "#18181b" }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>This page hit an error.</p>
        <p style={{ fontSize: 14, color: "#6b6b66", margin: "6px 0 16px" }}>The rest of the app still works. Reload to try this page again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ height: 36, padding: "0 14px", borderRadius: 8, border: 0, background: "#18181b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Reload
        </button>
      </div>
    );
  }
}
