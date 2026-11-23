import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "mrg_staff_clock_v1";
const IDLE_PAUSE_MS = 5 * 60 * 1000;

type Persisted = {
  clockedIn: boolean;
  paused: boolean;
  /** Epoch ms when the current running segment started (null if paused/out). */
  segmentStartedAt: number | null;
  /** Accumulated seconds from prior segments in this session. */
  accumulatedSeconds: number;
  lastActivityAt: number;
  pauseReason: string;
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      clockedIn: Boolean(p.clockedIn),
      paused: Boolean(p.paused),
      segmentStartedAt:
        typeof p.segmentStartedAt === "number" ? p.segmentStartedAt : null,
      accumulatedSeconds:
        typeof p.accumulatedSeconds === "number" ? p.accumulatedSeconds : 0,
      lastActivityAt:
        typeof p.lastActivityAt === "number" ? p.lastActivityAt : Date.now(),
      pauseReason: typeof p.pauseReason === "string" ? p.pauseReason : "",
    };
  } catch {
    return defaults();
  }
}

function defaults(): Persisted {
  return {
    clockedIn: false,
    paused: false,
    segmentStartedAt: null,
    accumulatedSeconds: 0,
    lastActivityAt: Date.now(),
    pauseReason: "",
  };
}

function save(p: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, "0");
}

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
}

function liveSeconds(p: Persisted, now: number): number {
  let total = p.accumulatedSeconds;
  if (p.clockedIn && !p.paused && p.segmentStartedAt != null) {
    total += Math.max(0, (now - p.segmentStartedAt) / 1000);
  }
  return total;
}

export type ClockTimer = {
  isClockedIn: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  elapsedLabel: string;
  pauseReason: string;
  clockIn: () => void;
  clockOut: () => { totalSeconds: number };
  pause: (reason?: string) => void;
  resume: (reason?: string) => void;
  /** Call when the staff records activity (task start, answer, etc.). */
  bumpActivity: () => void;
};

export function useClockTimer(): ClockTimer {
  const [state, setState] = useState<Persisted>(() =>
    typeof window === "undefined" ? defaults() : load(),
  );
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    if (!state.clockedIn || state.paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.clockedIn, state.paused]);

  // Auto-pause after 5 min idle while clocked in
  useEffect(() => {
    if (!state.clockedIn || state.paused) return;
    const id = window.setInterval(() => {
      const cur = stateRef.current;
      if (!cur.clockedIn || cur.paused) return;
      if (Date.now() - cur.lastActivityAt < IDLE_PAUSE_MS) return;
      const elapsed = liveSeconds(cur, Date.now());
      setState({
        ...cur,
        paused: true,
        segmentStartedAt: null,
        accumulatedSeconds: elapsed,
        pauseReason: "idle",
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [state.clockedIn, state.paused]);

  const clockIn = useCallback(() => {
    const t = Date.now();
    setState({
      clockedIn: true,
      paused: false,
      segmentStartedAt: t,
      accumulatedSeconds: 0,
      lastActivityAt: t,
      pauseReason: "",
    });
    setNow(t);
  }, []);

  const clockOut = useCallback(() => {
    const cur = stateRef.current;
    const totalSeconds = Math.floor(liveSeconds(cur, Date.now()));
    setState(defaults());
    setNow(Date.now());
    return { totalSeconds };
  }, []);

  const pause = useCallback((reason = "") => {
    const cur = stateRef.current;
    if (!cur.clockedIn || cur.paused) return;
    const elapsed = liveSeconds(cur, Date.now());
    setState({
      ...cur,
      paused: true,
      segmentStartedAt: null,
      accumulatedSeconds: elapsed,
      pauseReason: reason,
    });
  }, []);

  const resume = useCallback((reason = "") => {
    const t = Date.now();
    const cur = stateRef.current;
    if (!cur.clockedIn) return;
    setState({
      ...cur,
      paused: false,
      segmentStartedAt: t,
      lastActivityAt: t,
      pauseReason: reason || "",
    });
    setNow(t);
  }, []);

  const bumpActivity = useCallback(() => {
    const t = Date.now();
    const cur = stateRef.current;
    if (!cur.clockedIn) return;
    if (cur.paused) {
      // Activity alone does not unpause — caller must resume(reason)
      setState({ ...cur, lastActivityAt: t });
      return;
    }
    setState({ ...cur, lastActivityAt: t });
  }, []);

  const elapsedSeconds = Math.floor(liveSeconds(state, now));

  return {
    isClockedIn: state.clockedIn,
    isPaused: state.paused,
    elapsedSeconds,
    elapsedLabel: formatElapsed(elapsedSeconds),
    pauseReason: state.pauseReason,
    clockIn,
    clockOut,
    pause,
    resume,
    bumpActivity,
  };
}
