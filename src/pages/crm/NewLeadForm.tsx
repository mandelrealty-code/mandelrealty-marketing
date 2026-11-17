import { useEffect, useState } from "react";

/**
 * "+ Lead": a referral or walk-in typed in by a partner. It lands in the CRM at New with the AI closer paused for that
 * lead, so nothing is texted to the person until a partner turns it on. The form follows the entry design; the colours
 * follow the CRM it sits in.
 */

export const LEAD_SOURCES = ["Referral", "Meta ad", "Furniture contest", "Airbnb outreach", "Other"] as const;

const FIELD = "h-[46px] w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3.5 text-[15px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55";
const LABEL = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f6a65]";

export function NewLeadForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (lead: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState<(typeof LEAD_SOURCES)[number]>("Meta ad");
  const [referredBy, setReferredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(""); setPhone(""); setEmail(""); setAddress(""); setSource("Meta ad"); setReferredBy(""); setNotes(""); setError(""); setBusy(false);
  }, [open]);

  if (!open) return null;

  const save = async () => {
    const clean = name.replace(/\s+/g, " ").trim();
    if (!clean) { setError("A name is required."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createLead: true, name: clean, phone: phone.trim(), email: email.trim(), address: address.trim(), source, referredBy: source === "Referral" ? referredBy.trim() : "", notes: notes.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { lead?: Record<string, unknown>; error?: string };
      if (!res.ok || !data.lead) { setError(data.error || "Could not create the lead."); setBusy(false); return; }
      onCreated(data.lead);
    } catch {
      setError("Could not create the lead.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <button type="button" aria-label="Close" className="absolute inset-0" onClick={onClose} />
      <form
        onSubmit={(e) => { e.preventDefault(); void save(); }}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto border border-white/10 bg-[#141414] p-5 sm:rounded-lg"
      >
        <div>
          <h3 className="text-lg font-semibold text-[#f5f5f5]">New lead</h3>
          <p className="mt-1 text-[13px] text-[#9a9590]">Adds a lead to the CRM at the New stage. The AI stays off for it until you turn it on.</p>
        </div>
        <label className="flex flex-col gap-1.5"><span className={LABEL}>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" autoFocus className={FIELD} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className={LABEL}>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Any format" className={FIELD} /></label>
          <label className="flex flex-col gap-1.5"><span className={LABEL}>Email</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" className={FIELD} /></label>
        </div>
        <label className="flex flex-col gap-1.5"><span className={LABEL}>Property address <span className="normal-case tracking-normal">(optional)</span></span><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Start typing an address" className={FIELD} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className={LABEL}>Source</span>
            <select value={source} onChange={(e) => setSource(e.target.value as (typeof LEAD_SOURCES)[number])} className={FIELD}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {source === "Referral" ? (
            <label className="flex flex-col gap-1.5"><span className={LABEL}>Referred by</span><input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Who referred them" className={FIELD} /></label>
          ) : null}
        </div>
        <label className="flex flex-col gap-1.5"><span className={LABEL}>Notes <span className="normal-case tracking-normal">(optional)</span></span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything from the first contact" className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3.5 py-2.5 text-[15px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55" /></label>
        {error ? <p className="text-sm text-[#cf7f7b]">{error}</p> : null}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-[46px] flex-1 rounded-xl border border-white/10 text-sm font-semibold text-[#9a9590]">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="h-[46px] flex-1 rounded-xl bg-[#c4a35a] text-sm font-bold text-[#14100a] hover:bg-[#dcc084] disabled:opacity-60">{busy ? "Saving…" : "Save lead"}</button>
        </div>
      </form>
    </div>
  );
}
