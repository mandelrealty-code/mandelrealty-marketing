import { useCallback, useEffect, useMemo, useState } from "react";
import { InPdfSigner } from "./InPdfSigner";
import type { SignField } from "../../../shared/pm/signFields";

type Bootstrap = {
  user: {
    id: string;
    email: string;
    slug: string;
    first_name: string;
    must_change_password: boolean;
    pm_client_id: string;
  };
  client: { id: string; name: string; email: string; phone: string } | null;
  property: {
    id: string;
    name: string;
    address: string;
    cover_image_url: string | null;
  } | null;
  awaiting_contract: {
    id: string;
    title: string;
    filename: string;
    status: string;
    sign_fields?: SignField[];
  } | null;
  signed_contracts: Array<{
    id: string;
    title: string;
    filename: string;
    signed_on: string | null;
    signed_at: string | null;
    signature_name: string;
  }>;
  earnings: {
    year_month: string;
    net_to_host_cents: number;
    reservation_count: number;
    linked: boolean;
  } | null;
  session: { authenticated: boolean; must_change_password: boolean };
};

type Screen = "login" | "password" | "contract" | "dashboard" | "documents";

async function ownerApi<T>(
  op: string,
  opts?: { method?: "GET" | "POST"; body?: Record<string, unknown>; slug?: string },
): Promise<T> {
  const method = opts?.method ?? "GET";
  const params = new URLSearchParams({ op });
  if (opts?.slug) params.set("slug", opts.slug);
  const res = await fetch(`/api/owner?${params.toString()}`, {
    method,
    credentials: "include",
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({ op, ...opts?.body }) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function parseOwnerPath(pathname: string): { slug: string; rest: string } | null {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "owner" || !parts[1]) return null;
  return { slug: parts[1].toLowerCase(), rest: parts.slice(2).join("/") };
}

function GoldButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", disabled, ...rest } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      className={`w-full px-4 py-[17px] text-[15px] font-bold tracking-wide transition ${
        disabled
          ? "cursor-not-allowed bg-[#c4a35a]/25 text-[#6f6a65]"
          : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
      } ${className}`}
      {...rest}
    />
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
        {label}
      </span>
      {children}
    </label>
  );
}

function UnderlineInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`border-0 border-b border-white/16 bg-transparent px-0.5 py-2.5 text-base text-[#f5f5f5] outline-none focus:border-[#c4a35a] ${props.className ?? ""}`}
    />
  );
}

function MrgMark() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/mrg-logo.png"
        alt="Mandel Realty Group"
        className="h-8 w-8 rounded-[3px] object-contain"
      />
      <div className="text-[15px] font-bold tracking-[0.18em] text-[#c4a35a]">MRG</div>
    </div>
  );
}

export function OwnerApp() {
  const pathInfo = useMemo(
    () => parseOwnerPath(window.location.pathname),
    [],
  );
  const slug = pathInfo?.slug ?? "";
  const initialRest = pathInfo?.rest ?? "";

  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const go = useCallback((next: Screen, rest?: string) => {
    setScreen(next);
    const map: Record<Screen, string> = {
      login: "",
      password: "",
      contract: "contracts",
      dashboard: "",
      documents: "documents",
    };
    const pathRest = rest ?? map[next];
    const url = pathRest ? `/owner/${slug}/${pathRest}` : `/owner/${slug}`;
    window.history.replaceState({}, "", url);
  }, [slug]);

  const refresh = useCallback(async () => {
    const data = await ownerApi<Bootstrap>("bootstrap", { slug });
    setBoot(data);
    if (!email && data.user.email) setEmail(data.user.email);

    if (!data.session.authenticated) {
      setScreen("login");
      return data;
    }
    if (data.user.must_change_password) {
      setScreen("password");
      return data;
    }
    if (initialRest === "documents") {
      setScreen("documents");
    } else if (initialRest === "contracts" && data.awaiting_contract) {
      setScreen("contract");
    } else if (data.awaiting_contract && !data.signed_contracts.length) {
      setScreen("contract");
    } else {
      setScreen("dashboard");
    }
    return data;
  }, [slug, email, initialRest]);

  useEffect(() => {
    if (!slug) return;
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load portal."));
  }, [slug, refresh]);

  useEffect(() => {
    if (screen !== "contract" || !boot?.awaiting_contract || !boot.session.authenticated) {
      setPdfUrl(null);
      return;
    }
    ownerApi<{ url: string }>("contract_url", {
      slug,
      // GET with id
    })
      .catch(() => null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/owner?op=contract_url&id=${encodeURIComponent(boot.awaiting_contract!.id)}`,
          { credentials: "include" },
        );
        const data = (await res.json()) as { url?: string; error?: string };
        if (res.ok && data.url) setPdfUrl(data.url);
      } catch {
        /* ignore */
      }
    })();
  }, [screen, boot, slug]);

  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#9a9590]">
        Invalid owner link.
      </div>
    );
  }

  if (!boot && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#9a9590]">
        Loading…
      </div>
    );
  }

  if (error && !boot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0a] px-6 text-center">
        <MrgMark />
        <p className="text-[#cf7f7b]">{error}</p>
        <p className="max-w-sm text-sm text-[#6f6a65]">
          If you were invited recently, ask your MRG manager to resend the portal invite. Operators must run{" "}
          <code className="text-[#9a9590]">portal_owner_v1.sql</code> in Supabase.
        </p>
      </div>
    );
  }

  const firstName = boot?.user.first_name || "there";
  const propertyLabel = boot?.property
    ? `${boot.property.name}${boot.property.address ? ` · ${boot.property.address}` : ""}`
    : "Your property";
  const cover = boot?.property?.cover_image_url;

  const login = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await ownerApi<{
        must_change_password: boolean;
        bootstrap: Bootstrap;
      }>("login", {
        method: "POST",
        body: { slug, email, password },
      });
      setBoot(data.bootstrap);
      if (data.must_change_password) go("password");
      else if (
        data.bootstrap.awaiting_contract &&
        !data.bootstrap.signed_contracts?.length
      ) {
        go("contract");
      } else go("dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setBusy(true);
    setError("");
    try {
      await ownerApi("set_password", {
        method: "POST",
        body: { password: newPassword, confirm: confirmPassword },
      });
      const data = await refresh();
      if (data?.awaiting_contract && !data.signed_contracts.length) go("contract");
      else go("dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save password.");
    } finally {
      setBusy(false);
    }
  };

  const sign = async (input: { signatureName: string; signaturePng: string }) => {
    if (!boot?.awaiting_contract) return;
    setBusy(true);
    setError("");
    try {
      const data = await ownerApi<{ bootstrap: Bootstrap }>("sign", {
        method: "POST",
        body: {
          contract_id: boot.awaiting_contract.id,
          signature_name: input.signatureName,
          signature_image_base64: input.signaturePng,
        },
      });
      setBoot(data.bootstrap);
      go("dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign.");
    } finally {
      setBusy(false);
    }
  };

  const openDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/owner?op=contract_url&id=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Could not open file.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open file.");
    }
  };

  /* ——— Screens ——— */

  if (screen === "login") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] lg:grid lg:min-h-screen lg:grid-cols-[1.25fr_1fr]">
        <div className="relative h-[352px] overflow-hidden lg:h-auto lg:min-h-screen">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#1c1c1c] to-[#0a0a0a]" />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-b from-transparent to-[#0c0c0c] lg:hidden" />
          <div className="absolute left-6 top-6 lg:hidden">
            <MrgMark />
          </div>
        </div>
        <div className="flex flex-col bg-[#0c0c0c] px-7 pb-8 pt-3 lg:px-[68px] lg:py-16">
          <div className="mb-8 hidden lg:block">
            <MrgMark />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-8">
            <div className="flex flex-col gap-3">
              <h1 className="text-[30px] font-semibold leading-[1.08] tracking-tight lg:text-[44px]">
                Welcome to MRG,
                <br />
                {firstName}
              </h1>
              <p className="max-w-[34ch] text-[14px] text-[#9a9590] lg:text-base">
                {boot?.awaiting_contract
                  ? "Your owner portal — sign in to review and sign your agreement"
                  : "Your owner portal — sign in to view your property"}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f6a65]">
                {propertyLabel}
              </p>
            </div>
            <div className="flex flex-col gap-5">
              <Field label="Email">
                <UnderlineInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field label="Temporary password">
                <UnderlineInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="tracking-[0.3em]"
                />
              </Field>
              {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
              <GoldButton disabled={busy || !email || !password} onClick={login}>
                {busy ? "Signing in…" : "Continue"}
              </GoldButton>
              <a
                href="mailto:info@mandelrealtygroup.com"
                className="text-center text-[13px] text-[#9a9590] hover:text-[#c4a35a]"
              >
                Need help?
              </a>
            </div>
          </div>
          <p className="mt-8 text-[11px] uppercase tracking-[0.14em] text-[#4a4744]">
            Mandel Realty Group · Short-term rental management
          </p>
        </div>
      </div>
    );
  }

  if (screen === "password") {
    return (
      <div className="flex min-h-screen flex-col bg-[#0c0c0c] px-7 py-8 text-[#f5f5f5]">
        <MrgMark />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f6a65]">
              Step 1 of 3
            </p>
            <h1 className="text-[29px] font-semibold leading-tight tracking-tight">
              Choose a password
              <br />
              for your portal
            </h1>
          </div>
          <div className="flex flex-col gap-6">
            <Field label="New password">
              <UnderlineInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="tracking-[0.3em]"
              />
              <span className="text-xs text-[#6f6a65]">At least 8 characters</span>
            </Field>
            <Field label="Confirm password">
              <UnderlineInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`tracking-[0.3em] ${
                  confirmPassword && confirmPassword === newPassword ? "border-[#4ea882]" : ""
                }`}
              />
              {confirmPassword && confirmPassword === newPassword ? (
                <span className="text-xs text-[#4ea882]">Passwords match</span>
              ) : null}
            </Field>
            {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
            <GoldButton
              disabled={
                busy || newPassword.length < 8 || newPassword !== confirmPassword
              }
              onClick={savePassword}
            >
              {busy ? "Saving…" : "Save and continue"}
            </GoldButton>
            <p className="text-center text-[13px] text-[#6f6a65]">
              You’ll use this next time you sign in
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "contract" && boot?.awaiting_contract) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-[#f5f5f5]">
        <header className="flex items-center justify-between border-b border-white/9 bg-[#0c0c0c] px-5 py-4 lg:px-10">
          <div className="flex items-center gap-6">
            <MrgMark />
            <div className="hidden text-sm text-[#9a9590] lg:block">
              Agreement · {propertyLabel}
            </div>
          </div>
          <div className="text-xs text-[#6f6a65] lg:text-sm">{boot.awaiting_contract.filename}</div>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="mx-auto max-w-[820px]">
            {pdfUrl ? (
              <InPdfSigner
                pdfUrl={pdfUrl}
                fields={boot.awaiting_contract.sign_fields ?? []}
                signerHint={boot.client?.name || firstName}
                busy={busy}
                error={error}
                onFinish={sign}
              />
            ) : (
              <div className="flex h-[40vh] items-center justify-center text-sm text-[#6f6a65]">
                Loading agreement PDF…
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "documents") {
    return (
      <div className="min-h-screen bg-[#0c0c0c] text-[#f5f5f5]">
        <header className="flex items-center justify-between border-b border-white/9 px-5 py-4 lg:px-10">
          <MrgMark />
          <nav className="flex gap-5 text-sm">
            <button type="button" className="text-[#9a9590]" onClick={() => go("dashboard")}>
              Home
            </button>
            <span className="border-b border-[#c4a35a] pb-0.5 font-semibold">Documents</span>
          </nav>
          <span className="text-sm text-[#9a9590]">{boot?.client?.name}</span>
        </header>
        <div className="mx-auto max-w-4xl px-5 py-8 lg:px-10">
          <h1 className="text-[30px] font-semibold tracking-tight lg:text-[40px]">Documents</h1>
          <p className="mt-2 text-[13px] text-[#9a9590]">
            Your signed records for {propertyLabel}
          </p>
          <div className="mt-8 flex flex-col">
            {(boot?.signed_contracts ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 border-b border-white/8 py-5"
              >
                <div className="flex h-10 w-8 flex-none items-end justify-center border border-[#c4a35a]/50 pb-1">
                  <span className="text-[9px] font-bold tracking-wide text-[#c4a35a]">PDF</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-[12.5px] text-[#6f6a65]">
                    Signed {c.signed_on || "—"}
                    {c.signature_name ? ` · ${c.signature_name}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-[#c4a35a]"
                  onClick={() => openDoc(c.id)}
                >
                  Download
                </button>
              </div>
            ))}
            {!boot?.signed_contracts?.length ? (
              <p className="py-8 text-sm text-[#9a9590]">No signed documents yet.</p>
            ) : null}
            <div className="flex items-center gap-4 border-b border-white/8 py-5 opacity-70">
              <div className="h-10 w-8 flex-none border border-dashed border-white/14" />
              <div>
                <div className="text-[15px] text-[#9a9590]">Monthly statements</div>
                <div className="text-[13px] text-[#6f6a65]">
                  Appear here once your listing is live
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard / setup holding
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5]">
      <header className="flex items-center justify-between border-b border-white/9 px-5 py-4 lg:px-10">
        <MrgMark />
        <nav className="flex gap-5 text-sm">
          <span className="border-b border-[#c4a35a] pb-0.5 font-semibold">Home</span>
          <button type="button" className="text-[#9a9590]" onClick={() => go("documents")}>
            Documents
          </button>
        </nav>
        <span className="text-sm text-[#9a9590]">{boot?.client?.name}</span>
      </header>
      {cover ? (
        <div className="h-44 w-full overflow-hidden lg:h-56">
          <img src={cover} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4ea882]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4ea882]">
            {boot?.signed_contracts?.length
              ? "Agreement signed"
              : boot?.awaiting_contract
                ? "Agreement ready to sign"
                : "Portal ready"}
          </span>
        </div>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight lg:text-[42px]">
          You’re in, {firstName}
        </h1>
        {boot?.property ? (
          <p className="mt-2 text-[15px] text-[#9a9590]">
            {boot.property.name}
            {boot.property.address ? ` · ${boot.property.address}` : ""}
          </p>
        ) : null}
        {boot?.earnings ? (
          <div className="mt-8 border-t border-white/8 pt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6a65]">
              This month
            </div>
            <div className="mt-2 text-[36px] font-semibold tracking-tight">
              ${(boot.earnings.net_to_host_cents / 100).toLocaleString("en-CA", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="mt-1 text-[14px] text-[#9a9590]">
              Net to you · {boot.earnings.reservation_count} booking
              {boot.earnings.reservation_count === 1 ? "" : "s"}
            </div>
          </div>
        ) : (
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-[#9a9590] lg:text-base">
            {boot?.signed_contracts?.length
              ? "Your listing details and documents are here. Earnings show once this month’s bookings are connected."
              : "Our team is finishing setup — full earnings appear here once your listing is connected."}
          </p>
        )}
        {boot?.awaiting_contract ? (
          <button
            type="button"
            className="mt-4 text-[15px] font-semibold text-[#c4a35a]"
            onClick={() => go("contract")}
          >
            Sign your agreement →
          </button>
        ) : boot?.signed_contracts?.length ? (
          <button
            type="button"
            className="mt-4 text-[15px] font-semibold text-[#c4a35a]"
            onClick={() => go("documents")}
          >
            View signed agreement →
          </button>
        ) : null}
        {!boot?.earnings && !boot?.signed_contracts?.length ? (
          <>
            <div className="mt-10 flex flex-col gap-0 border-t border-white/8">
              {["Connect Airbnb", "Link your calendar", "Earnings unlock when live"].map(
                (step, i) => (
                  <div
                    key={step}
                    className="flex items-center gap-4 border-b border-white/8 py-4 text-[15px]"
                  >
                    <span className="font-mono text-xs text-[#6f6a65]">{i + 1}</span>
                    <span>{step}</span>
                  </div>
                ),
              )}
            </div>
            <p className="mt-6 text-[13px] text-[#6f6a65]">
              You’ll get an email the day your listing goes live.
            </p>
          </>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[#cf7f7b]">{error}</p> : null}
      </div>
    </div>
  );
}
