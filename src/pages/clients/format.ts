export function formatDisplayDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRateHistoryRange(
  from: string,
  to: string | null,
): string {
  if (!to) return `from ${formatDisplayDate(from)}`;
  const fromD = new Date(`${from}T12:00:00`);
  const toD = new Date(`${to}T12:00:00`);
  if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
    return `${from} – ${to}`;
  }
  const sameYear = fromD.getFullYear() === toD.getFullYear();
  const fromLabel = fromD.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const toLabel = toD.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  if (sameYear && fromD.getMonth() === toD.getMonth()) {
    return fromLabel;
  }
  return `${fromLabel} – ${toLabel}`;
}

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function clientSubtitle(email: string, phone: string): string {
  const parts = [email.trim(), phone.trim()].filter(Boolean);
  return parts.join(" · ") || "No contact info";
}
