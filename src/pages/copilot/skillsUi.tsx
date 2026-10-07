import { useEffect, useRef } from "react";
import type { CopilotMessage, CopilotReport, CopilotTextSend, SkillRow } from "../../../shared/copilot/types";
import { runWhen, whenLabel } from "./skillsTime";

/** Skills screens, built from docs Claude Design "MRG Copilot Skills". */

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7.5l2.5 2.5L11 4.5" />
    </svg>
  );
}

function Chev() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--quiet)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="cp-sk-chev">
      <path d="M7 4.5L11.5 9 7 13.5" />
    </svg>
  );
}

export function Switch({ on }: { on: boolean }) {
  return (
    <span className={`cp-sk-track${on ? " on" : ""}`}>
      <span className="cp-sk-knob" />
    </span>
  );
}

function rowStatus(skill: SkillRow, log: CopilotTextSend[]): { dot: string; text: string } {
  if (!skill.enabled) return { dot: "var(--quiet)", text: "Off · won’t run until you turn it on" };
  if (skill.kind === "text") {
    const last = log.find((row) => row.skill_id === skill.id);
    return last
      ? { dot: "var(--done)", text: `Texted ${runWhen(last.created_at)}${last.unit ? ` · ${last.unit}` : ""}` }
      : { dot: "var(--quiet)", text: "Hasn’t texted yet" };
  }
  const run = skill.lastRun;
  if (!run) {
    return { dot: "var(--quiet)", text: skill.schedule === "daily" ? "Hasn’t run yet · first run tomorrow, ~5:00" : "Hasn’t run yet" };
  }
  if (run.status === "running") return { dot: "var(--primary)", text: "Running now · the report lands in its chat" };
  if (run.status === "failed") return { dot: "var(--danger)", text: `Failed ${runWhen(run.started_at)} · ${run.error || "it couldn’t finish"}` };
  const waiting = run.result?.tools.includes("propose_draft") && run.result.needs_you;
  return {
    dot: waiting ? "var(--primary)" : "var(--done)",
    text: `Worked ${runWhen(run.started_at)}${run.result?.headline ? ` · ${run.result.headline}` : ""}`,
  };
}

export function SkillsList({
  skills,
  log,
  onOpen,
  onToggle,
  onNew,
  onBoard,
}: {
  skills: SkillRow[];
  log: CopilotTextSend[];
  onOpen: (skill: SkillRow) => void;
  onToggle: (skill: SkillRow) => void;
  onNew: () => void;
  onBoard: (kind: "seed" | "blank") => void;
}) {
  return (
    <>
      <div className="cp-boards">
        <button type="button" onClick={() => onBoard("seed")}>
          <span><strong>Review text</strong><em>Texts you when a new review arrives. It does not text a guest.</em></span>
          <Chev />
        </button>
        <button type="button" onClick={() => onBoard("blank")}>
          <span><strong>New workflow</strong><em>A blank board. Add the first step.</em></span>
          <Chev />
        </button>
      </div>
      <div className="cp-sk-head">
        <div className="cp-sk-headcopy">
          <h1>Skills</h1>
          <p>Copilot runs these on its own. Shared by both partners.</p>
        </div>
        {skills.length ? (
          <button type="button" className="cp-sk-gold cp-sk-desknew" onClick={onNew}>New skill</button>
        ) : null}
      </div>
      {skills.length ? (
        <div className="cp-sk-box">
          {skills.map((skill) => {
            const status = rowStatus(skill, log);
            return (
              <div key={skill.id} className="cp-sk-row" onClick={() => onOpen(skill)}>
                <div className="cp-sk-rowcopy">
                  <span className={`cp-sk-when${skill.enabled ? "" : " off"}`}>{whenLabel(skill)}</span>
                  <span className={`cp-sk-name${skill.enabled ? "" : " off"}`}>{skill.name}</span>
                  <span className="cp-sk-status">
                    <span className="cp-sk-dot" style={{ background: status.dot }} />
                    <span>{status.text}</span>
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={skill.enabled}
                  aria-label={skill.enabled ? "Turn off" : "Turn on"}
                  className="cp-sk-switch"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(skill);
                  }}
                >
                  <Switch on={skill.enabled} />
                </button>
                <Chev />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cp-sk-empty">
          <div className="cp-sk-emptycopy">
            <span className="t">No skills yet</span>
            <span className="d">Describe a task in chat. Copilot drafts the skill, you save it, and it runs on its own.</span>
          </div>
          <button type="button" className="cp-sk-gold big" onClick={onNew}>New skill</button>
          <span className="n">Anything meant for a guest, host or client waits for your Approve.</span>
        </div>
      )}
    </>
  );
}

export type SkillFormState = { name: string; when: string; reads: string; drafts: string; mustNot: string; phone: string };

function Grow({ value, onChange, readOnly }: { value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className="cp-sk-val"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

function prettyPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return phone;
}

export function SkillDetail({
  skill,
  form,
  onForm,
  saved,
  busy,
  runBusy,
  runMsg,
  log,
  onToggle,
  onSave,
  onDelete,
  onRun,
  onOpenChat,
}: {
  skill: SkillRow;
  form: SkillFormState;
  onForm: (patch: Partial<SkillFormState>) => void;
  saved: boolean;
  busy: boolean;
  runBusy: boolean;
  runMsg: string | null;
  log: CopilotTextSend[];
  onToggle: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRun: () => void;
  onOpenChat: () => void;
}) {
  const text = skill.kind === "text";
  const run = skill.lastRun;
  const running = runBusy || run?.status === "running";
  const drafts = Boolean(run?.result?.tools.includes("propose_draft"));
  const myLog = log.filter((row) => row.skill_id === skill.id);

  let card: { word: string; time: string; line: string; sub: string; dot: string; color: string };
  if (running) {
    card = {
      word: "Running",
      time: run?.status === "running" ? `Started ${runWhen(run.started_at)}` : "Starting",
      line: "This can take a few minutes.",
      sub: "You can leave this page. The report lands in this skill’s chat.",
      dot: "var(--primary)",
      color: "var(--text)",
    };
  } else if (!run) {
    card = {
      word: "Not run yet",
      time: "",
      line: skill.schedule === "daily" ? "The first run is tomorrow, ~5:00." : "Press Run now to try it.",
      sub: "Nothing was sent.",
      dot: "var(--quiet)",
      color: "var(--muted)",
    };
  } else if (run.status === "failed") {
    card = { word: "Failed", time: runWhen(run.started_at, true), line: run.error || "It couldn’t finish.", sub: "Nothing was sent.", dot: "var(--danger)", color: "var(--danger)" };
  } else {
    card = {
      word: "Worked",
      time: runWhen(run.started_at, true),
      line: run.result?.headline ? `${run.result.headline.replace(/\.$/, "")}.` : "It finished.",
      sub: "Nothing was sent.",
      dot: "var(--done)",
      color: "var(--done)",
    };
  }

  const fields: { label: string; key?: keyof SkillFormState; value?: string; hint?: string; chips?: string[]; readOnly?: boolean }[] = [
    { label: "Name", key: "name" },
    text
      ? { label: "When it runs", key: "when" }
      : {
          label: "When it runs",
          value: whenLabel(skill),
          hint: skill.schedule === "daily" ? "Fixed schedule." : "Runs when you ask in chat.",
          readOnly: true,
        },
    ...(text ? [] : [{ label: "What it reads", key: "reads" as const }]),
    text
      ? { label: "Text message", key: "drafts", hint: "{unit} becomes the unit name." }
      : { label: drafts ? "What it drafts" : "What it leaves you", key: "drafts" },
    ...(text ? [{ label: "Numbers to text", chips: form.phone ? [prettyPhone(form.phone)] : [] }] : []),
    { label: "It must not", key: "mustNot" },
  ];

  const note = text
    ? "Saving doesn’t text anyone. The next clean texts only the numbers below."
    : skill.schedule === "daily"
      ? "Saving doesn’t run it. The next run is tomorrow, ~5:00."
      : "Saving doesn’t send anything. It runs when you ask in chat.";

  return (
    <>
      <div className="cp-sk-dhead">
        <div className="cp-sk-dheadcopy">
          <span className="w">{whenLabel(skill)}</span>
          <h1>{form.name || skill.name}</h1>
        </div>
        <button type="button" role="switch" aria-checked={skill.enabled} className="cp-sk-dswitch" disabled={busy} onClick={onToggle}>
          {skill.enabled ? "On" : "Off"}
          <Switch on={skill.enabled} />
        </button>
      </div>

      {!text ? (
        <div className="cp-sk-run">
          <span className="k">Last run</span>
          <div className="cp-sk-runbody">
            <span className="cp-sk-runword">
              {running ? <span className="cp-sk-spin" /> : <span className="cp-sk-dot big" style={{ background: card.dot }} />}
              <span style={{ color: card.color }}>{card.word}</span>
              {card.time ? <span className="t">{card.time}</span> : null}
            </span>
            <span className="l">{card.line}</span>
            <span className="s">{card.sub}</span>
            {runMsg && !running ? <span className="s">{runMsg}</span> : null}
          </div>
          <div className="cp-sk-btns">
            <button type="button" className="cp-sk-soft" disabled={running} onClick={onRun}>{running ? "Running" : "Run now"}</button>
            {skill.chat_id ? (
              <button type="button" className="cp-sk-ghost strong" onClick={onOpenChat}>{drafts ? "Open drafts" : "Open report"}</button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="cp-sk-box">
        {fields.map((field) => (
          <div key={field.label} className="cp-sk-field">
            <span className="k">{field.label}</span>
            {field.chips ? (
              <div className="cp-sk-chips">
                {field.chips.length ? field.chips.map((chip) => <span key={chip} className="cp-sk-chip">{chip}</span>) : <span className="cp-sk-hint">No number yet. Add one in Connectors → Twilio.</span>}
              </div>
            ) : field.key ? (
              <Grow value={form[field.key]} onChange={(v) => onForm({ [field.key as string]: v })} />
            ) : (
              <Grow value={field.value ?? ""} readOnly />
            )}
            {field.hint ? <span className="cp-sk-hint">{field.hint}</span> : null}
          </div>
        ))}
      </div>

      <div className="cp-sk-btns foot">
        <button type="button" className="cp-sk-gold" disabled={busy} onClick={onSave}>{saved ? "Saved" : "Save"}</button>
        <button type="button" className="cp-sk-ghost" disabled={busy} onClick={onToggle}>{skill.enabled ? "Turn off" : "Turn on"}</button>
        <button type="button" className="cp-sk-ghost danger push" onClick={onDelete}>Delete</button>
      </div>
      <p className="cp-sk-note">{note}</p>

      {text && myLog.length ? (
        <div className="cp-sk-log">
          <span className="h">Texts sent</span>
          <div className="cp-sk-box">
            {myLog.map((row) => (
              <div key={row.id} className="cp-sk-field">
                <span className="cp-sk-logmeta">
                  <b>Texted</b>
                  {[runWhen(row.created_at, true), row.unit].filter(Boolean).join(" · ")}
                </span>
                <span className="cp-sk-logmsg">{row.body}</span>
              </div>
            ))}
          </div>
          <span className="cp-sk-hint">Only the partners’ numbers on this skill get texts.</span>
        </div>
      ) : null}
    </>
  );
}

export function SkillDraftCard({
  message,
  phone,
  onPhone,
  busy,
  onSave,
  onSkip,
}: {
  message: CopilotMessage;
  phone: string;
  onPhone: (v: string) => void;
  busy: boolean;
  onSave: () => void;
  onSkip: () => void;
}) {
  const d = message.draft;
  if (!d) return null;
  const text = d.skillKind === "text";
  const daily = !text && d.skillSchedule === "daily";
  const rows: [string, string][] = [
    ["Name", d.skillName ?? ""],
    ["When it runs", daily ? "Every morning, ~5:00" : d.skillWhen ?? ""],
    ...(text ? [] : ([["What it reads", d.skillReads ?? ""]] as [string, string][])),
    [text ? "Text message" : "What it leaves you", d.skillDrafts ?? ""],
    ["It must not", d.skillMustNot ?? ""],
  ];
  return (
    <div className="cp-sk-prop">
      <p>{message.body}</p>
      <div className="cp-sk-card">
        <div className="cp-sk-cardhead">Skill draft</div>
        {rows.map(([label, value]) => (
          <div key={label} className="cp-sk-propfield">
            <span className="k">{label}</span>
            <span className="v">{value}</span>
          </div>
        ))}
        {text ? (
          <label className="cp-sk-propfield">
            <span className="k">Text me at</span>
            <input
              className="cp-sk-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Your mobile number"
              value={phone}
              onChange={(e) => onPhone(e.target.value)}
              disabled={d.status !== "waiting"}
            />
          </label>
        ) : null}
        {d.status === "approved_unsent" ? (
          <div className="cp-sk-saved"><Check />Saved to Skills</div>
        ) : null}
      </div>
      {d.status === "waiting" ? (
        <>
          <div className="cp-sk-btns">
            <button type="button" className="cp-sk-gold" disabled={busy} onClick={onSave}>Save</button>
            <button type="button" className="cp-sk-ghost" disabled={busy} onClick={onSkip}>Not now</button>
          </div>
          <p className="cp-sk-after">
            {text
              ? "Once saved, it texts only your number. It never texts a guest."
              : daily
                ? "Once saved, it runs on its own every morning. Turn it off any time in Skills."
                : "Once saved, it runs when you ask in chat. Turn it off any time in Skills."}
          </p>
        </>
      ) : null}
      {d.status === "approved_unsent" ? (
        <p>
          {text
            ? "Saved. It texts your number when that happens."
            : daily
              ? "Saved. First run tomorrow, ~5:00. The report lands in its own chat."
              : "Saved. Ask for it in chat when you need it."}
        </p>
      ) : null}
      {d.status === "held" ? <p className="cp-sk-mutedp">Not saved. Ask again any time.</p> : null}
    </div>
  );
}

export function ReportCard({
  message,
  report,
  onRun,
  running,
}: {
  message: CopilotMessage;
  report: CopilotReport;
  onRun?: () => void;
  running?: boolean;
}) {
  const hasDetails = report.sections.some((sec) => sec.rows.some((row) => row.details?.length));
  return (
    <div className="cp-sk-report">
      <span className="cp-sk-stamp">{runWhen(message.created_at, true)}</span>
      <div className="cp-sk-card">
        <div className="cp-sk-rephead">
          <span className="t">{report.title}</span>
          {report.summary ? <span className="s">{report.summary}</span> : null}
        </div>
        {report.failed ? (
          <div className="cp-sk-fail">
            <span className="w"><span className="cp-sk-dot big" style={{ background: "var(--danger)" }} />Failed</span>
            <span className="l">{report.failed.line}</span>
            {report.failed.sub ? <span className="s">{report.failed.sub}</span> : null}
          </div>
        ) : (
          report.sections.map((sec) => (
            <div key={sec.title} className="cp-sk-sec">
              <div className="cp-sk-sechead">
                <span className="t">{sec.title}</span>
                <span className="c">{sec.rows.length}</span>
              </div>
              {sec.rows.map((row, i) => (
                <div key={`${row.who}-${i}`} className="cp-sk-secrow">
                  <span className="who">{row.who}</span>
                  {row.meta ? <span className="meta">{row.meta}</span> : null}
                  {row.details?.length ? (
                    <span className="cp-sk-tags">{row.details.map((d) => <span key={d}>{d}</span>)}</span>
                  ) : null}
                  {row.quote ? <span className="q">{row.quote}</span> : null}
                </div>
              ))}
              <div className="cp-sk-secgap" />
            </div>
          ))
        )}
      </div>
      {report.failed && onRun ? (
        <div className="cp-sk-btns">
          <button type="button" className="cp-sk-gold" disabled={running} onClick={onRun}>{running ? "Running" : "Run now"}</button>
        </div>
      ) : null}
      {!report.failed && hasDetails ? (
        <p className="cp-sk-after">“May have sent” means the message looks like it holds these details. Check before you rely on them.</p>
      ) : null}
    </div>
  );
}

export function EmailDraftCard({
  message,
  body,
  onBody,
  busy,
  onApprove,
  onHold,
}: {
  message: CopilotMessage;
  body: string;
  onBody: (v: string) => void;
  busy: boolean;
  onApprove: () => void;
  onHold: () => void;
}) {
  const d = message.draft;
  if (!d) return null;
  const to = (d.to || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  return (
    <div className="cp-sk-prop">
      {message.run_id ? <span className="cp-sk-stamp">{runWhen(message.created_at, true)}</span> : null}
      <p className="cp-sk-pre">{message.body}</p>
      <div className="cp-sk-card">
        <div className="cp-sk-mailmeta">
          <div className="r">
            <span className="k top">To</span>
            <div className="cp-sk-chips">
              {to.length ? to.map((item) => <span key={item} className="cp-sk-chip sm">{item}</span>) : <span className="cp-sk-chip sm">Not set</span>}
            </div>
          </div>
          <div className="r">
            <span className="k">Subject</span>
            <span className="subj">{d.subject || "No subject"}</span>
          </div>
        </div>
        <div className="cp-sk-mailbody">
          {d.status === "waiting" ? <Grow value={body} onChange={onBody} /> : <span className="cp-sk-pre">{d.body}</span>}
        </div>
      </div>
      {d.status === "waiting" ? (
        <>
          <span className="cp-sk-waiting"><span className="cp-sk-dot" style={{ background: "var(--primary)" }} />Waiting for you</span>
          <div className="cp-sk-btns">
            <button type="button" className="cp-sk-gold" disabled={busy} onClick={onApprove}>Submit</button>
            <button type="button" className="cp-sk-ghost" disabled={busy} onClick={onHold}>Hold</button>
          </div>
          <p className="cp-sk-after muted">Submit sends this reply. Hold keeps it here.</p>
        </>
      ) : null}
      {d.status === "sent" ? (
        <>
          <span className="cp-sk-approved"><Check />Sent</span>
          <p className="cp-sk-tight">Sent.</p>
        </>
      ) : null}
      {d.status === "approved_unsent" ? (
        <>
          <span className="cp-sk-approved"><Check />Not sent</span>
          <p className="cp-sk-tight">{message.body || "Not sent. It stays here."}</p>
        </>
      ) : null}
      {d.status === "held" ? <p className="cp-sk-mutedp">On hold. Nothing was sent.</p> : null}
    </div>
  );
}
