import { useEffect, useRef, useState } from "react";
import type { AdminProductMode } from "../clients/mode";
import { pmGet, pmPost } from "../clients/api";
import { mountOnboarding, ONBOARDING_CSS } from "./engine";

/**
 * Onboarding, built from the design file as it was drawn (markup, colours and phone layout), with the units, tasks and
 * schedule read from and written to the app. The design runs inside its own shadow root, so its colours and class names
 * cannot touch the rest of the admin.
 */

type Data = Record<string, unknown>;

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export default function OnboardingApp({ onModeChange }: { onModeChange: (mode: AdminProductMode) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const warnedPlaces = useRef(false);
  const [ready, setReady] = useState(false);
  const modeRef = useRef(onModeChange);
  modeRef.current = onModeChange;

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
        style.textContent = ONBOARDING_CSS + "\n:host{display:block}";
        const root = document.createElement("div");
        root.className = "onb";
        shadow.append(style, root);
        const host = {
          data,
          load,
          act: (op: string, payload: Record<string, unknown>) => pmPost<Data>("onboarding", { op, ...payload }),
          go: (mode: string) => modeRef.current(mode as AdminProductMode),
          onError: (e: unknown) => setError(e instanceof Error ? e.message : "That did not work."),
          suggest: async (q: string) => {
            const r = await pmPost<{ predictions?: { description: string }[]; errorCode?: string }>("places", { action: "autocomplete", input: q });
            if (r.errorCode === "MISSING_GOOGLE_MAPS_API_KEY" && !warnedPlaces.current) {
              warnedPlaces.current = true;
              setNote("Address suggestions are not set up yet: GOOGLE_MAPS_API_KEY is missing on the server. You can still type the address.");
            }
            return r.predictions ?? [];
          },
          onNote: (res: { notified?: { emailed: string[]; failed: { name: string; why: string }[]; noLogin: string[] } } | null) => {
            const n = res?.notified;
            if (!n) return;
            const parts: string[] = [];
            if (n.emailed.length) parts.push(`Emailed ${n.emailed.join(", ")} about their tasks.`);
            if (n.noLogin.length) parts.push(`No employee login for ${n.noLogin.join(", ")}, so no email was sent. Add a login under OPS, Team.`);
            for (const f of n.failed) parts.push(`The email to ${f.name} did not send: ${f.why}`);
            if (parts.length) setNote(parts.join(" "));
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
    <div style={{ background: "#ffffff", minHeight: "100dvh" }}>
      {error ? (
        <div role="alert" style={{ padding: "12px 20px", background: "#fdf3e3", color: "#7a4b00", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14 }}>
          {error}
        </div>
      ) : null}
      {note ? (
        <div role="status" style={{ padding: "12px 20px", background: "#f2f2ef", color: "#18181b", fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, display: "flex", gap: 12, justifyContent: "space-between" }}>
          <span>{note}</span>
          <button type="button" onClick={() => setNote("")} style={{ border: 0, background: "none", cursor: "pointer", color: "#55554f", fontSize: 13 }}>Dismiss</button>
        </div>
      ) : null}
      {!ready && !error ? <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif", color: "#6b6b66" }}>Loading Onboarding…</div> : null}
      <div ref={holder} />
    </div>
  );
}
