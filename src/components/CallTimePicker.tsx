import { useMemo, useState } from "react";
import { generateCallSlots, type CallSlot } from "../../shared/callSlots";

type Props = {
  value: string;
  onChange: (startIso: string) => void;
};

/**
 * Native MRG time picker — exact slots, 24h+ notice, Toronto time.
 * No third-party branding; we call the phone number already on the form.
 */
export function CallTimePicker({ value, onChange }: Props) {
  const slots = useMemo(() => generateCallSlots(), []);
  const days = useMemo(() => {
    const map = new Map<string, CallSlot[]>();
    for (const s of slots) {
      const list = map.get(s.dayLabel) ?? [];
      list.push(s);
      map.set(s.dayLabel, list);
    }
    return [...map.entries()];
  }, [slots]);

  const [dayIndex, setDayIndex] = useState(0);
  const activeDay = days[dayIndex] ?? days[0];
  const daySlots = activeDay?.[1] ?? [];

  if (slots.length === 0) {
    return (
      <p className="rounded-2xl bg-mrg-bg px-4 py-5 text-sm text-mrg-muted ring-1 ring-white/10">
        No call times available right now. Please try again tomorrow or call us.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-mrg-bg ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-mrg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="/mrg-logo-white.png" alt="" aria-hidden className="h-5 w-auto opacity-90" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-mrg-gold">
              Mandel Realty Group
            </p>
            <p className="truncate text-sm text-mrg-text">We&apos;ll call your phone</p>
          </div>
        </div>
        <p className="shrink-0 text-[11px] text-mrg-muted">15 min · ET</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-b border-white/8 px-3 py-3">
        {days.map(([label], i) => {
          const active = i === dayIndex;
          const short = label.replace(/,.*/, "");
          return (
            <button
              key={label}
              type="button"
              onClick={() => setDayIndex(i)}
              className={`shrink-0 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                active
                  ? "bg-mrg-gold text-black"
                  : "bg-white/5 text-mrg-muted hover:bg-white/10 hover:text-mrg-text"
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {daySlots.map((slot) => {
          const active = value === slot.startIso;
          return (
            <button
              key={slot.startIso}
              type="button"
              onClick={() => onChange(slot.startIso)}
              className={`rounded-xl px-3 py-3 text-sm font-semibold transition-all ${
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

      <div className="border-t border-white/8 bg-mrg-surface px-4 py-2.5 text-center text-[11px] text-mrg-muted">
        Earliest bookings are 24 hours out · Eastern Time
      </div>
    </div>
  );
}
