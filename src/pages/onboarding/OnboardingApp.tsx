import { useEffect, useRef, useState } from "react";
import type { AdminProductMode } from "../clients/mode";
import { pmGet, pmPost } from "../clients/api";
import { mountOnboarding, ONBOARDING_CSS } from "./engine";
import IntakeProgress from "./IntakeProgress";

/**
 * Onboarding, built from the design file as it was drawn (markup, colours and phone layout), with the units, tasks and
 * schedule read from and written to the app. The design runs inside its own shadow root, so its colours and class names
 * cannot touch the rest of the admin.
 */

type Data = Record<string, unknown>;

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

/** What the CRM asked Onboarding to open: a unit, or the start-onboarding form for a lead. Set once, read once. */
export const ONBOARDING_OPEN_KEY = "onb-open";
export function askOnboardingToOpen(target: { unit?: string; startLead?: string }): void {
  try {
    window.sessionStorage.setItem(ONBOARDING_OPEN_KEY, JSON.stringify(target));
  } catch {
    /* The unit is one click away in the pipeline. */
  }
}
function takeOpenRequest(): { unit?: string; startLead?: string } | null {
  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_OPEN_KEY);
    window.sessionStorage.removeItem(ONBOARDING_OPEN_KEY);
    return raw ? (JSON.parse(raw) as { unit?: string; startLead?: string }) : null;
  } catch {
    return null;
  }
}

/** The onboarding server call. Unlike pmPost it keeps the error body, so "already in onboarding" can carry the unit to open. */
async function onboardingAct(op: string, payload: Record<string, unknown>): Promise<Data> {
  const res = await fetch("/api/admin/pm?resource=onboarding", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...payload }),
  });
  const data = (await res.json().catch(() => ({}))) as Data & { error?: string };
  if (!res.ok) throw Object.assign(new Error(String(data.error || "Request failed.")), data);
  return data;
}

export default function OnboardingApp({
  onModeChange,
  onOpenLead,
  onNewLead,
  embedded = false,
}: {
  onModeChange: (mode: AdminProductMode, patch?: Partial<import("../../lib/adminRoute").AdminRoute>) => void;
  onOpenLead?: (leadId: string) => void;
  onNewLead?: () => void;
  /** Parent HubShell owns the product sidebar — hide Onboarding's duplicate chrome. */
  embedded?: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  /** The full Intake progress page, opened from "View all →" on a unit's Audit task. */
  const [intake, setIntake] = useState<{ unitId: string; cleanerPropertyId: string; address: string } | null>(null);
  const [note, setNote] = useState("");
  const warnedPlaces = useRef(false);
  const [ready, setReady] = useState(false);
  const modeRef = useRef(onModeChange);
  modeRef.current = onModeChange;
  const leadRef = useRef(onOpenLead);
  leadRef.current = onOpenLead;
  const newLeadRef = useRef(onNewLead);
  newLeadRef.current = onNewLead;

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
    document.title = "Onboarding | Mandel Realty Group";
    let cancelled = false;
    let mounted: { destroy: () => void } | null = null;
    const load = () => pmGet<Data>("onboarding");
    load()
      .then((data) => {
        if (cancelled || !holder.current) return;
        const shadow = holder.current.shadowRoot ?? holder.current.attachShadow({ mode: "open" });
        shadow.innerHTML = "";
        const style = document.createElement("style");
        style.textContent = ONBOARDING_CSS;
        const root = document.createElement("div");
        root.className = embedded ? "onb embed" : "onb";
        shadow.append(style, root);
        const host = {
          data,
          load,
          act: onboardingAct,
          get: (query: Record<string, string>) => pmGet<Data>("onboarding", query),
          go: (mode: string, patch?: Record<string, unknown>) =>
            modeRef.current(mode as AdminProductMode, patch as Parameters<typeof modeRef.current>[1]),
          openLead: (id: string) => leadRef.current?.(id),
          openIntake: (target: { unitId: string; cleanerPropertyId: string; address: string }) => setIntake(target),
          openCrmLeadForm: () => newLeadRef.current?.(),
          open: takeOpenRequest(),
          onError: (e: unknown) => setError(e instanceof Error ? e.message : "That did not work."),
          suggest: async (q: string) => {
            const r = await pmPost<Data>("places", { action: "autocomplete", input: q }).catch(() => ({} as Data));
            const places = r as { predictions?: { description: string }[]; errorCode?: string };
            if (places.errorCode === "MISSING_GOOGLE_MAPS_API_KEY" && !warnedPlaces.current) {
              warnedPlaces.current = true;
              setNote("Address suggestions are not set up yet: GOOGLE_MAPS_API_KEY is missing on the server. You can still type the address.");
            }
            return places.predictions ?? [];
          },
        };
        mounted = mountOnboarding(root, host);
        setReady(true);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Onboarding did not load."));
    return () => {
      cancelled = true;
      mounted?.destroy();
    };
  }, []);

  return (
    <div
      style={{
        background: "#ffffff",
        height: embedded ? "100%" : "100dvh",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {error ? (
        <div role="alert" style={{ padding: "12px 20px", background: "#fdf3e3", color: "#7a4b00", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, display: "flex", gap: 12, justifyContent: "space-between", flex: "none" }}>
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} style={{ border: 0, background: "none", cursor: "pointer", color: "#7a4b00", fontSize: 13 }}>Dismiss</button>
        </div>
      ) : null}
      {note ? (
        <div role="status" style={{ padding: "12px 20px", background: "#f2f2ef", color: "#18181b", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, display: "flex", gap: 12, justifyContent: "space-between", flex: "none" }}>
          <span>{note}</span>
          <button type="button" onClick={() => setNote("")} style={{ border: 0, background: "none", cursor: "pointer", color: "#55554f", fontSize: 13 }}>Dismiss</button>
        </div>
      ) : null}
      {!ready && !error ? <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif", color: "#6b6b66" }}>Loading Onboarding…</div> : null}
      <div ref={holder} style={{ flex: 1, minHeight: 0, height: "100%" }} />
      {intake ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Intake progress · ${intake.address}`}
          style={{ position: "absolute", inset: 0, zIndex: 40, background: "#f2f2ef", overflowY: "auto", fontFamily: "Inter, system-ui, sans-serif" }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIntake(null);
          }}
        >
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px clamp(16px, 3vw, 32px) 40px" }}>
            <button
              type="button"
              autoFocus
              onClick={() => setIntake(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "none", padding: "6px 0", cursor: "pointer", color: "#55554f", fontSize: 14, fontWeight: 500 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Onboarding
            </button>
            <div style={{ margin: "6px 0 18px" }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "#18181b" }}>{intake.address || "Unit"}</h1>
              <div style={{ fontSize: 14, color: "#55554f", marginTop: 4 }}>Intake progress</div>
            </div>
            <IntakeProgress
              unitId={intake.unitId}
              cleanerPropertyId={intake.cleanerPropertyId}
              address={intake.address}
              onOpenLead={(id) => {
                setIntake(null);
                leadRef.current?.(id);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
