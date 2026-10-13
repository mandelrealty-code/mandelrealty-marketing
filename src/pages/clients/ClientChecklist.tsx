import { useEffect, useState } from "react";
import { pmGet } from "./api";

type Step = {
  id: string;
  done: boolean;
  text: string;
};

/** The open and finished setup steps already stored on this client. */
export function ClientChecklist({ clientId }: { clientId: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    setError("");
    pmGet<{ steps: Step[]; notes: string[] }>("client_checklist", { client_id: clientId })
      .then((data) => {
        if (cancel) return;
        setSteps(data.steps ?? []);
        setNotes(data.notes ?? []);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        setError(err instanceof Error ? err.message : "The checklist didn't return.");
      });
    return () => {
      cancel = true;
    };
  }, [clientId]);

  if (error) {
    return <p className="text-[13px] text-[#cf7f7b]">{error}</p>;
  }

  const open = steps.filter((step) => !step.done);
  const done = steps.filter((step) => step.done);

  return (
    <div className="mt-2 border-t border-white/8 pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a9590]">Checklist</div>
      {notes.map((note) => (
        <p key={note} className="mt-2 text-[13px] text-[#cf7f7b]">{note}</p>
      ))}
      {!steps.length && !notes.length ? (
        <p className="mt-2 text-[13px] text-[#9a9590]">Nothing is waiting on this client.</p>
      ) : null}
      <ul className="mt-2 flex flex-col gap-2">
        {open.map((step) => (
          <li key={step.id} className="text-[13px] leading-snug text-[#f5f5f5]">
            <span className="mr-2 text-[#c4a35a]">○</span>
            {step.text.replace(/^[^:]+:\s*/, "")}
          </li>
        ))}
        {done.map((step) => (
          <li key={step.id} className="text-[13px] leading-snug text-[#9a9590]">
            <span className="mr-2">✓</span>
            {step.text.replace(/^[^:]+:\s*/, "")}
          </li>
        ))}
      </ul>
    </div>
  );
}
