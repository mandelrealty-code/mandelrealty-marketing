import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export function MrgMark({ size = 22 }: { size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-md bg-[#f5f5f5] font-bold tracking-wide text-[#0a0a0a]"
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.38) }}
      aria-hidden
    >
      MRG
    </div>
  );
}

export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: "crm" | "clients";
  onChange: (mode: "crm" | "clients") => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/8 bg-[#1a1a1a] p-0.5">
      <button
        type="button"
        onClick={() => onChange("crm")}
        className={`rounded-md px-3 py-1 text-xs font-semibold ${
          mode === "crm"
            ? "bg-[#c4a35a] text-[#0a0a0a]"
            : "text-[#9a9590] hover:text-[#f5f5f5]"
        }`}
      >
        CRM
      </button>
      <button
        type="button"
        onClick={() => onChange("clients")}
        className={`rounded-md px-3 py-1 text-xs font-semibold ${
          mode === "clients"
            ? "bg-[#c4a35a] text-[#0a0a0a]"
            : "text-[#9a9590] hover:text-[#f5f5f5]"
        }`}
      >
        Clients
      </button>
    </div>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
        active ? "bg-[#c4a35a]" : "bg-[#3a3a3a]"
      }`}
    />
  );
}

export function FieldLabel({
  children,
  optional,
}: {
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6f6a65]">
      {children}
      {optional ? (
        <span className="ml-1 font-medium normal-case tracking-normal">optional</span>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55 ${
        props.className ?? ""
      }`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-[52px] w-full resize-none rounded-[9px] border border-white/10 bg-[#1c1c1c] px-3.5 py-3 text-[15px] text-[#f5f5f5] outline-none placeholder:text-[#6f6a65] focus:border-[#c4a35a]/55 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Sheet({
  title,
  onCancel,
  children,
  desktop,
}: {
  title: string;
  onCancel: () => void;
  children: ReactNode;
  desktop?: boolean;
}) {
  if (desktop) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/66 p-4">
        <div className="w-full max-w-[460px] rounded-[14px] border border-white/10 bg-[#141414] p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-bold text-[#f5f5f5]">{title}</h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-[#9a9590] hover:text-[#f5f5f5]"
            >
              Cancel
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/66">
      <button type="button" className="flex-1" aria-label="Dismiss" onClick={onCancel} />
      <div className="rounded-t-2xl border-t border-white/10 bg-[#141414] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/14" />
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onCancel} className="text-[13px] text-[#9a9590]">
            Cancel
          </button>
          <h2 className="text-[15px] font-bold text-[#f5f5f5]">{title}</h2>
          <span className="w-11" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function GoldButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-[9px] bg-[#c4a35a] px-4 py-3.5 text-center text-[15px] font-bold text-[#0a0a0a] hover:bg-[#dcc084] disabled:opacity-60 ${
        props.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}
