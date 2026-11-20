import { useEffect, useRef, useState } from "react";

type SignPayload = {
  contract: {
    id: string;
    title: string;
    storage_path: string;
    client_id: string | null;
  };
  clientName: string;
  planName: string;
  propertyLabel: string;
  pdf_url: string | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; code: string }
  | { kind: "ready"; data: SignPayload }
  | { kind: "done"; firstName: string };

function tokenFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get("token")?.trim() || "";
  } catch {
    return "";
  }
}

function firstNameOf(full: string): string {
  return full.trim().split(/\s+/)[0] || "there";
}

export function SignPage() {
  const token = tokenFromUrl();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [signing, setSigning] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        if (!cancelled) setState({ kind: "error", code: "invalid_token" });
        return;
      }
      try {
        const res = await fetch(`/api/sign?token=${encodeURIComponent(token)}`, {
          credentials: "omit",
        });
        const data = (await res.json()) as SignPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok || data.error) {
          setState({ kind: "error", code: data.error || "invalid_token" });
          return;
        }
        setSignedName(data.clientName || "");
        setState({ kind: "ready", data });
      } catch {
        if (!cancelled) setState({ kind: "error", code: "invalid_token" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const paintStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    );
  };

  const paintMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    );
    ctx.stroke();
  };

  const clearPad = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const submit = async () => {
    if (state.kind !== "ready") return;
    const name = signedName.trim();
    if (!name) {
      setErr("Enter the name you are signing as.");
      return;
    }
    const canvas = canvasRef.current;
    const signature_data_url = canvas ? canvas.toDataURL("image/png") : "";
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/sign?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          signed_name: name,
          signature_data_url,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not sign. Please try again.");
        return;
      }
      setState({ kind: "done", firstName: firstNameOf(name) });
    } catch {
      setErr("Could not sign. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white text-[#18181b] font-[Inter,system-ui,sans-serif]">
      <header className="flex items-center gap-3 border-b border-[#e8e8e3] px-5 py-4">
        <img src="/mrg-logo.png" alt="Mandel Realty Group" className="h-9 w-9" />
        <div className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[#c4a35a]">
          MRG
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-5 py-8 pb-16">
        {state.kind === "loading" && (
          <p className="text-[14px] text-[#9a9590]">Loading agreement…</p>
        )}

        {state.kind === "error" && state.code === "already_signed" && (
          <div className="rounded-2xl border border-[#e8e8e3] bg-[#f2f2ef] px-5 py-8 text-center">
            <div className="text-[22px] font-semibold">✓ You’ve already signed this agreement.</div>
            <p className="mt-2 text-[14px] text-[#6f6a65]">Thank you!</p>
          </div>
        )}

        {state.kind === "error" && state.code !== "already_signed" && (
          <div className="rounded-2xl border border-[#e8e8e3] bg-[#f2f2ef] px-5 py-8 text-center">
            <div className="text-[18px] font-semibold">This link is invalid or has expired.</div>
            <p className="mt-2 text-[14px] text-[#6f6a65]">
              Please contact Mandel Realty Group.
            </p>
          </div>
        )}

        {state.kind === "done" && (
          <div className="rounded-2xl border border-[#e8e8e3] bg-[#f2f2ef] px-5 py-8 text-center">
            <div className="text-[22px] font-semibold">✓ Signed successfully</div>
            <p className="mt-3 text-[15px] leading-relaxed text-[#3f3f46]">
              Thank you, {state.firstName}. Your signed agreement has been sent to{" "}
              mandelrealtyteam@gmail.com. We’ll be in touch shortly.
            </p>
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <div className="mb-6">
              <h1 className="text-[28px] font-bold tracking-[-0.02em]">Management Agreement</h1>
              <p className="mt-1 text-[15px] text-[#52525b]">
                {[state.data.planName, state.data.propertyLabel].filter(Boolean).join(" · ") ||
                  state.data.contract.title}
              </p>
              <p className="mt-1 text-[13px] text-[#9a9590]">
                Prepared for {state.data.clientName}
              </p>
            </div>

            <section className="mb-8 overflow-hidden rounded-2xl border border-[#e8e8e3] bg-[#f9f9f7]">
              {state.data.pdf_url ? (
                <>
                  <iframe
                    title="Agreement PDF"
                    src={state.data.pdf_url}
                    className="h-[min(70vh,720px)] w-full border-0 bg-white"
                  />
                  <div className="border-t border-[#e8e8e3] px-4 py-3 text-center">
                    <a
                      href={state.data.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-semibold text-[#18181b] underline underline-offset-2"
                    >
                      Review agreement (PDF) →
                    </a>
                  </div>
                </>
              ) : (
                <div className="px-4 py-10 text-center text-[14px] text-[#9a9590]">
                  Agreement PDF is unavailable. Please contact Mandel Realty Group.
                </div>
              )}
            </section>

            {!signing ? (
              <section className="rounded-2xl border border-[#e8e8e3] p-5">
                <h2 className="text-[18px] font-semibold">Ready to sign?</h2>
                <button
                  type="button"
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-[10px] bg-[#18181b] text-[15px] font-semibold text-white"
                  onClick={() => setSigning(true)}
                >
                  Start signing →
                </button>
              </section>
            ) : (
              <section className="rounded-2xl border border-[#e8e8e3] p-5">
                <h2 className="text-[18px] font-semibold">Sign agreement</h2>
                <label className="mt-4 block text-[12px] font-semibold text-[#3f3f46]">
                  Sign as
                  <input
                    value={signedName}
                    onChange={(e) => setSignedName(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-[10px] border border-[#e8e8e3] px-3 text-[15px] outline-none focus:border-[#18181b]"
                    autoComplete="name"
                  />
                </label>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#3f3f46]">Signature</span>
                    <button
                      type="button"
                      className="text-[12px] font-medium text-[#9a9590] underline"
                      onClick={clearPad}
                    >
                      Clear
                    </button>
                  </div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={180}
                    className="w-full touch-none rounded-[10px] border border-[#e8e8e3] bg-white"
                    onPointerDown={paintStart}
                    onPointerMove={paintMove}
                    onPointerUp={() => {
                      drawing.current = false;
                    }}
                    onPointerLeave={() => {
                      drawing.current = false;
                    }}
                  />
                </div>
                {err ? <p className="mt-3 text-[13px] text-[#b45309]">{err}</p> : null}
                <button
                  type="button"
                  disabled={busy}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-[10px] bg-[#18181b] text-[15px] font-semibold text-white disabled:opacity-50"
                  onClick={() => void submit()}
                >
                  {busy ? "Signing…" : "Sign agreement"}
                </button>
                <p className="mt-3 text-[12px] leading-relaxed text-[#9a9590]">
                  By signing you agree to the terms of the management agreement above. Today’s date
                  will be recorded as the contract start date.
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
