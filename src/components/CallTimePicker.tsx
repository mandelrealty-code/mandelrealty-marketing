import { useEffect, useMemo, useState } from "react";
import { generateCallSlots, type CallSlot } from "../../shared/callSlots";

type Props = {
  value: string;
  onChange: (startIso: string) => void;
};

/**
 * Native MRG time picker — exact half-hour slots, 24h+ notice, Toronto time.
 * Fetches booked times so taken slots disappear.
 */
export function CallTimePicker({ value, onChange }: Props) {
  const [booked, setBooked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/booked-slots", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { booked?: string[] };
        if (!cancelled) setBooked(data.booked ?? []);
      } catch {
        /* picker still works without conflict list */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slots = useMemo(() => generateCallSlots(new Date(), booked), [booked]);
  const days = useMemo(() => {
    const map = new Map<string, { short: string; label: string; slots: CallSlot[] }>();
    for (const s of slots) {
      const existing = map.get(s.dayKey);
      if (existing) existing.slots.push(s);
      else map.set(s.dayKey, { short: s.dayShort, label: s.dayLabel, slots: [s] });
    }
    return [...map.entries()];
  }, [slots]);

  const [dayIndex, setDayIndex] = useState(0);
  const activeDay = days[dayIndex] ?? days[0];
  const daySlots = activeDay?.[1].slots ?? [];

  useEffect(() => {
    if (dayIndex >= days.length) setDayIndex(0);
  }, [days.length, dayIndex]);

  if (!loading && slots.length === 0) {
    return (
      <p className="rounded-2xl bg-mrg-bg px-4 py-5 text-sm text-mrg-muted ring-1 ring-white/10">
        No call times available right now. Please try again tomorrow or call us.
      </p>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl bg-mrg-bg ring-1 ring-white/10">
      <div className="flex items-center gap-3 border-b border-white/8 bg-mrg-surface px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <img
            src="/mrg-logo-white.png"
            alt=""
            aria-hidden
            className="h-5 w-auto shrink-0 opacity-90"
          />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-mrg-gold sm:text-xs">
              Mandel Realty Group
            </p>
            <p className="truncate text-sm text-mrg-text">We&apos;ll call your phone</p>
          </div>
        </div>
        <p className="shrink-0 text-[11px] text-mrg-muted">30 min · ET</p>
      </div>

      <div className="min-w-0 overflow-x-auto overscroll-x-contain border-b border-white/8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-1.5 px-3 py-3">
          {days.map(([dayKey, day], i) => {
            const active = i === dayIndex;
            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => setDayIndex(i)}
                title={day.label}
                className={`shrink-0 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  active
                    ? "bg-mrg-gold text-black"
                    : "bg-white/5 text-mrg-muted hover:bg-white/10 hover:text-mrg-text"
                }`}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {loading && daySlots.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-xl bg-white/5"
                aria-hidden
              />
            ))
          : daySlots.map((slot) => {
              const active = value === slot.startIso;
              return (
                <button
                  key={slot.startIso}
                  type="button"
                  onClick={() => onChange(slot.startIso)}
                  className={`min-w-0 rounded-xl px-2 py-2.5 text-sm font-semibold tabular-nums transition-all sm:px-3 sm:py-3 ${
                    active
                      ? "bg-mrg-gold text-black ring-2 ring-mrg-gold"
                      : "bg-mrg-surface text-mrg-text ring-1 ring-white/10 hover:ring-mrg-gold/40"
                  }`}
                >
                  {slot.timeLabel}
                </button>
              );
            })}
      </div>
    </div>
  );
}
