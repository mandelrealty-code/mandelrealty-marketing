/** A partner never sees a filesystem error. A failed report says what failed. */

export const REPORT_FILE_FAILURE = "The report could not be generated because the report file could not be saved.";

const RAW_FS = /ENOENT|EROFS|EACCES|EPERM|ENOTDIR|ENOSPC|mkdir|\/var\/task|no such file|read-only file system|syscall/i;

export function isFilesystemError(err: unknown): boolean {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return /^(ENOENT|EACCES|EPERM|EROFS|ENOTDIR|ENOSPC|EISDIR)$/.test(code) || isFilesystemText(message);
}

export function isFilesystemText(text: string): boolean {
  const trimmed = text.trim();
  return Boolean(trimmed) && trimmed.length <= 300 && RAW_FS.test(trimmed);
}

export function withoutFilesystemDetail(text: string, report: boolean): string {
  if (!isFilesystemText(text)) return text;
  return report ? REPORT_FILE_FAILURE : "That could not be saved.";
}
