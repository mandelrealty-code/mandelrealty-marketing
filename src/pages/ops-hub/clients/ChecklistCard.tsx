import { useEffect, useState } from "react";
import { pmGet } from "../../clients/api";
import { Icon } from "./icons";

type Step = { id: string; done: boolean; text: string };

export function ChecklistCard({ clientId }: { clientId: string }) {
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

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="card">
      <div className="cardhead">
        <h3>
          <Icon name="clip" className="i sm" />
          Onboarding checklist
        </h3>
        <span className="meta">
          {steps.length ? `${doneCount} of ${steps.length} done · read only` : "read only"}
        </span>
      </div>
      {error ? <p className="meta" style={{ padding: "12px 16px" }}>{error}</p> : null}
      {notes.map((note) => (
        <p key={note} className="hint bad" style={{ padding: "0 16px", marginTop: 10 }}>
          {note}
        </p>
      ))}
      {!steps.length && !notes.length && !error ? (
        <div className="empty" style={{ padding: "22px 16px" }}>
          <b style={{ fontSize: "var(--t-sm)" }}>Nothing waiting on this client</b>
        </div>
      ) : (
        <ul className="chk">
          {steps.map((step) => {
            const label = step.text.replace(/^[^:]+:\s*/, "");
            return (
              <li key={step.id} className={step.done ? undefined : "open"}>
                <span className={`ck ${step.done ? "on" : "off"}`}>
                  {step.done ? <Icon name="check" className="i xs" /> : null}
                </span>
                <div>
                  <b>{label}</b>
                  <span className="meta">{step.done ? "Done" : "Open"}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
