import type { MemoryFileView } from "../../../shared/copilot/types";

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4.5L11.5 9 7 13.5" />
    </svg>
  );
}

export function MemoryFileList({
  files,
  onOpen,
}: {
  files: MemoryFileView[];
  onOpen: (path: string) => void;
}) {
  if (!files.length) {
    return (
      <div className="cp-mem-empty">
        <p>No memories yet. Tell Copilot to remember something in chat.</p>
      </div>
    );
  }
  const groups: { id: MemoryFileView["group"]; title: string }[] = [
    { id: "today", title: "Today" },
    { id: "files", title: "Memories" },
    { id: "tonight", title: "Tonight" },
  ];
  return (
    <div className="cp-mem">
      {groups.map((group) => {
        const rows = files.filter((file) => file.group === group.id);
        if (!rows.length) return null;
        return (
          <section key={group.id} className="cp-mem-group">
            <h2>{group.title}</h2>
            {rows.map((file) => (
              <button key={file.path} type="button" className="cp-setrow" onClick={() => onOpen(file.path)}>
                <span>
                  <strong>{file.title}</strong>
                  <em>{file.quiet}</em>
                </span>
                <Chevron />
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function MemoryFileDetail({
  file,
  onDelete,
}: {
  file: MemoryFileView;
  onDelete: () => void;
}) {
  return (
    <article className="cp-mem-file">
      <h1>{file.title}</h1>
      <p className="cp-mem-label">{file.label}</p>
      <pre>{file.body.replace(/\n*Cited from .+$/gim, "").trim()}</pre>
      <button type="button" className="cp-mem-delete" onClick={onDelete}>Delete</button>
    </article>
  );
}

export function MemoryWrote({
  title,
  preview,
  onOpen,
}: {
  title: string;
  preview: string;
  onOpen: () => void;
}) {
  return (
    <div className="cp-memcard">
      <strong>{title}</strong>
      {preview ? <pre>{preview}</pre> : null}
      <button type="button" onClick={onOpen}>Open</button>
    </div>
  );
}
