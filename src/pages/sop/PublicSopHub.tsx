import { useEffect, useState, useRef, useMemo } from "react";
import type { SopItem, SopStep } from "../../../shared/pm/sopTypes";
import { getSopVideoBlob } from "../../lib/sopVideoStorage";

interface PublicSopHubProps {
  initialSlug?: string | null;
}

function parseTimeToSeconds(t: string | undefined): number {
  if (!t) return 0;
  const clean = String(t).replace(/[^\d:]/g, "").trim();
  const parts = clean.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0];
  }
  return 0;
}

function formatSeconds(sec: number): string {
  const valid = Math.max(0, isNaN(sec) ? 0 : sec);
  const m = Math.floor(valid / 60);
  const s = Math.floor(valid % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function isHttpUrl(v: string | undefined | null): boolean {
  return Boolean(v && /^https?:\/\//i.test(v));
}

/** True only for real video SOPs — not regular document guides. */
function sopHasVideo(sop: SopItem | null | undefined): boolean {
  if (!sop) return false;
  if (isHttpUrl(sop.video_url)) return true;
  if (sop.transcript && sop.transcript.length > 0) return true;
  if (
    sop.steps?.some(
      (s) =>
        s.media_type === "video_embed" ||
        isHttpUrl(s.video_url) ||
        (typeof s.seconds === "number" && s.seconds > 0) ||
        Boolean(s.timestamp && String(s.timestamp).trim() && String(s.timestamp).trim() !== "0:00"),
    )
  ) {
    return true;
  }
  const author = (sop.author || "").toLowerCase();
  const summary = (sop.summary || "").toLowerCase();
  if (author.includes("video studio") || author.includes("(video)")) return true;
  if (summary.includes("video guide") || summary.includes("video walkthrough")) return true;
  return false;
}

export function PublicSopHub({ initialSlug }: PublicSopHubProps) {
  const [sop, setSop] = useState<SopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"video" | "doc" | "guide">("doc");

  // Video State & Source
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stepCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Step Progress State (persisted in localStorage per SOP)
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [guideStepIdx, setGuideStepIdx] = useState(0);
  const [guideFinished, setGuideFinished] = useState(false);

  // Copy Feedback State
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Lightbox State
  const [lightboxImg, setLightboxImg] = useState<{ src: string; title: string } | null>(null);

  // Fetch individual SOP by slug
  useEffect(() => {
    async function load() {
      const slug = initialSlug?.trim();
      if (!slug) {
        setError("Guide not found");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sop?slug=${encodeURIComponent(slug)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sop) {
            const fetchedSop: SopItem = data.sop;
            setSop(fetchedSop);
            setVideoSrc(null);

            const isVideo = sopHasVideo(fetchedSop);
            setViewMode(isVideo ? "video" : "doc");

            // Only resolve a video source for real video SOPs
            if (isVideo) {
              if (fetchedSop.video_url && fetchedSop.video_url.startsWith("http")) {
                setVideoSrc(fetchedSop.video_url);
              } else {
                getSopVideoBlob(fetchedSop.slug).then((blob) => {
                  if (blob) {
                    setVideoSrc(URL.createObjectURL(blob));
                  } else if (fetchedSop.video_url && fetchedSop.video_url.startsWith("http")) {
                    setVideoSrc(fetchedSop.video_url);
                  } else if (fetchedSop.video_url) {
                    setVideoSrc(`/api/sop?slug=${encodeURIComponent(fetchedSop.slug)}&video=1`);
                  }
                });
              }
            }

            try {
              const key = `mrg_sop_progress_${fetchedSop.slug}`;
              const saved = localStorage.getItem(key);
              if (saved) {
                setCompletedSteps(JSON.parse(saved));
              }
            } catch {}
          } else {
            setError("Standard Operating Procedure not found or has been unpublished.");
          }
        } else {
          setError("Standard Operating Procedure not found or has been unpublished.");
        }
      } catch {
        setError("Unable to load procedure. Please check your network connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [initialSlug]);

  // Video chapters & transcript list with calculated seconds
  const videoSteps = useMemo(() => {
    if (!sop) return [];
    const steps = sop.steps || [];
    const isVideo = sopHasVideo(sop);

    return steps
      .map((step, idx) => {
        if (!isVideo) {
          return { ...step, seconds: 0, timestamp: undefined as string | undefined };
        }
        const hasRealTime =
          step.seconds != null || Boolean(step.timestamp && String(step.timestamp).trim());
        const parsedSec = hasRealTime
          ? step.seconds != null
            ? step.seconds
            : parseTimeToSeconds(step.timestamp)
          : idx * 6;
        const timeStr = step.timestamp || formatSeconds(parsedSec);
        return {
          ...step,
          seconds: parsedSec,
          timestamp: timeStr,
        };
      })
      .sort((a, b) => (isVideo ? a.seconds - b.seconds : a.step_number - b.step_number));
  }, [sop]);

  // Fallback duration parsed from summary "(Duration: 0:13)" or estimated minutes or max step
  const fallbackDuration = useMemo(() => {
    if (!sop) return 0;
    const match = sop.summary?.match(/duration:\s*(\d+:\d+|\d+)/i);
    if (match && match[1]) {
      const s = parseTimeToSeconds(match[1]);
      if (s > 0) return s;
    }
    if (sop.steps && sop.steps.length > 0) {
      let maxSec = 0;
      for (const st of sop.steps) {
        const sec = st.seconds != null ? st.seconds : parseTimeToSeconds(st.timestamp);
        if (sec > maxSec) maxSec = sec;
      }
      if (maxSec > 0) return maxSec + 5;
    }
    return (sop.estimated_minutes || 1) * 60;
  }, [sop]);

  const effectiveDuration = duration > 0 ? duration : (fallbackDuration || 1);

  // Active step highlight tracking based on current video playback
  useEffect(() => {
    if (!videoSteps.length) return;
    let currentActive: string | null = null;
    for (let i = 0; i < videoSteps.length; i++) {
      const step = videoSteps[i];
      const nextStep = videoSteps[i + 1];
      const stepStart = step.seconds;
      const stepEnd = nextStep ? nextStep.seconds : (effectiveDuration || stepStart + 30);

      if (currentTime >= stepStart - 0.5 && currentTime < stepEnd) {
        currentActive = step.id;
        break;
      }
    }
    if (!currentActive && videoSteps.length > 0) {
      if (currentTime >= videoSteps[videoSteps.length - 1].seconds - 0.5) {
        currentActive = videoSteps[videoSteps.length - 1].id;
      }
    }
    setActiveStepId(currentActive);
  }, [currentTime, videoSteps, effectiveDuration]);

  // Video Playback Controls
  const handleTogglePlay = () => {
    if (!videoRef.current) {
      setIsPlaying(!isPlaying);
      return;
    }
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(true);
      });
    }
  };

  const handleSeek = (timeSec: number) => {
    const clamped = Math.max(0, Math.min(effectiveDuration, timeSec));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      if (!isPlaying) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const handleJumpStep = (step: SopStep) => {
    const sec = step.seconds != null ? step.seconds : parseTimeToSeconds(step.timestamp);
    handleSeek(sec);
    // Scroll step into view smoothly
    const el = stepCardRefs.current[step.id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleSkip = (secondsDelta: number) => {
    if (!videoRef.current) return;
    const nextTime = Math.max(0, Math.min(effectiveDuration, (videoRef.current.currentTime || 0) + secondsDelta));
    handleSeek(nextTime);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setIsMuted(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
  };

  const handleToggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  // Toggle Step Checkbox
  const handleToggleStep = (stepId: string) => {
    if (!sop) return;
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      try {
        localStorage.setItem(`mrg_sop_progress_${sop.slug}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Reset Progress
  const handleResetProgress = () => {
    if (!sop) return;
    setCompletedSteps({});
    try {
      localStorage.removeItem(`mrg_sop_progress_${sop.slug}`);
    } catch {}
    setGuideStepIdx(0);
    setGuideFinished(false);
  };

  // Copy Script Handler
  const handleCopyScript = (scriptText: string, scriptId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(scriptText).catch(() => {});
    }
    setCopiedScriptId(scriptId);
    setTimeout(() => setCopiedScriptId(null), 2400);
  };

  // Share Link Handler
  const handleShareLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setShareToast("Link copied to clipboard");
    setTimeout(() => setShareToast(null), 2500);
  };

  const stepsList = sop?.steps || [];
  const completedCount = stepsList.filter((s) => completedSteps[s.id]).length;
  const progressPct = stepsList.length ? Math.round((completedCount / stepsList.length) * 100) : 0;
  const guidePct = stepsList.length ? Math.round(((guideStepIdx + 1) / stepsList.length) * 100) : 0;

  const isVideoSop = sopHasVideo(sop);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans antialiased pb-24 selection:bg-[#c4a35a]/30 selection:text-white">
      {/* Top MRG Branded Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0c0c0c]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3 select-none">
            {/* Bowtie Mark */}
            <div className="flex items-center gap-[2px]">
              <div
                className="h-5 w-3.5 bg-[#c4a35a]"
                style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
              />
              <div
                className="h-5 w-3.5 bg-[#c4a35a]"
                style={{ clipPath: "polygon(100% 0, 0 50%, 100% 100%)" }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wider text-[#f5f5f5]">
                MANDEL REALTY GROUP
              </span>
              <span className="text-[10.5px] text-[#6f6a65] tracking-tight">
                Standard Operating Procedure Guide
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-[#c4a35a]/10 border border-[#c4a35a]/30 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider text-[#c4a35a]">
              Direct SOP Access
            </span>
          </div>
        </div>
      </header>

      {/* Loading state */}
      {loading && (
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#c4a35a] border-t-transparent mb-3" />
          <p className="text-xs text-[#9a9590]">Loading procedure...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <main className="mx-auto max-w-lg px-6 pt-20 text-center animate-fade-in">
          <div className="rounded-xl border border-white/10 bg-[#121212] p-8 space-y-4 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[#c4a35a] mx-auto text-lg">
              !
            </div>
            <h2 className="text-lg font-bold text-[#f5f5f5]">Guide Unavailable</h2>
            <p className="text-xs text-[#9a9590] leading-relaxed">
              {error}
            </p>
          </div>
        </main>
      )}

      {/* Detail SOP View */}
      {!loading && sop && (
        <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 animate-fade-in">
          {/* Action Sub-Header */}
          <div className="sticky top-[57px] z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-[#0a0a0a]/95 backdrop-blur-md py-3 mb-6">
            <div className="flex items-center gap-2.5 min-w-0">
              {isVideoSop && (
                <span className="flex items-center gap-1.5 rounded-full bg-[#c4a35a]/15 border border-[#c4a35a]/35 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-[#dcc084] shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c4a35a] animate-pulse" />
                  VIDEO GUIDE
                </span>
              )}
              <span className="text-xs sm:text-sm font-semibold text-[#f5f5f5] truncate max-w-[220px] sm:max-w-md">
                {sop.title}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded border border-white/10 bg-[#161616] px-3 py-1.5 text-xs font-semibold text-[#cfc9c2] hover:bg-[#202020] transition hidden sm:inline-block"
              >
                Export PDF / Print
              </button>
              <button
                type="button"
                onClick={handleShareLink}
                className="rounded border border-white/10 bg-[#161616] px-3 py-1.5 text-xs font-semibold text-[#cfc9c2] hover:bg-[#202020] transition"
              >
                {shareToast ? "✓ Copied" : "Share Link"}
              </button>

              {/* View Mode Toggle */}
              <div className="flex gap-0.5 rounded-md border border-white/8 bg-[#141414] p-0.5">
                {isVideoSop && (
                  <button
                    type="button"
                    onClick={() => setViewMode("video")}
                    className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold transition ${
                      viewMode === "video"
                        ? "bg-[#c4a35a] text-[#0a0a0a]"
                        : "text-[#9a9590] hover:text-[#f5f5f5]"
                    }`}
                  >
                    <span>🎥</span>
                    <span>Video &amp; Transcript</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewMode("doc")}
                  className={`rounded px-3 py-1 text-xs font-bold transition ${
                    viewMode === "doc"
                      ? "bg-[#c4a35a] text-[#0a0a0a]"
                      : "text-[#9a9590] hover:text-[#f5f5f5]"
                  }`}
                >
                  Document View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("guide")}
                  className={`rounded px-3 py-1 text-xs font-bold transition ${
                    viewMode === "guide"
                      ? "bg-[#c4a35a] text-[#0a0a0a]"
                      : "text-[#9a9590] hover:text-[#f5f5f5]"
                  }`}
                >
                  Guide Me Mode
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MODE 1: DEDICATED SYNCHRONIZED VIDEO & TRANSCRIPT STUDIO VIEW (DEFAULT)   */}
          {/* ========================================================================= */}
          {viewMode === "video" && (
            <div className="space-y-6">
              {/* Header Title & Meta */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-xs text-[#6f6a65] flex-wrap">
                  <span className="rounded bg-[#c4a35a]/10 border border-[#c4a35a]/30 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase text-[#c4a35a]">
                    {sop.category}
                  </span>
                  <span className="font-medium text-[#cfc9c2]">
                    Role: {sop.target_role.toUpperCase()} TEAM
                  </span>
                  <span>·</span>
                  <span>{`${formatSeconds(effectiveDuration)} Video`}</span>
                  <span>·</span>
                  <span className="text-[#5fbf7d] font-semibold">1080P HD · AUDIO SYNC</span>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#f5f5f5] leading-tight">
                  {sop.title}
                </h1>
              </div>

              {/* Objective Callout Box */}
              {sop.summary && (
                <div className="rounded-r-lg border-y border-r border-white/8 border-l-2 border-l-[#c4a35a] bg-[#121212] p-4 sm:p-5 shadow-md flex items-start gap-3">
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                      Objective &amp; Instructions
                    </span>
                    <p className="text-sm text-[#cfc9c2] leading-relaxed">{sop.summary}</p>
                  </div>
                </div>
              )}

              {/* Split Dual-Column Workspace: Video on Left / Synchronized Transcript on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Sticky Video Player & Custom Controls */}
                <div className="lg:col-span-7 xl:col-span-7 space-y-4 lg:sticky lg:top-[120px]">
                  {/* Video Player Box */}
                  <div className="relative rounded-2xl border border-white/12 bg-[#0c0c0e] overflow-hidden shadow-2xl group aspect-video flex items-center justify-center">
                    {videoSrc ? (
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        className="w-full h-full object-contain cursor-pointer bg-black"
                        onClick={handleTogglePlay}
                        onTimeUpdate={(e) => {
                          const cur = e.currentTarget.currentTime;
                          setCurrentTime(cur);
                          const d = e.currentTarget.duration;
                          if (d && isFinite(d) && d > 0) {
                            setDuration(d);
                          } else if (e.currentTarget.seekable && e.currentTarget.seekable.length > 0) {
                            try {
                              const sEnd = e.currentTarget.seekable.end(e.currentTarget.seekable.length - 1);
                              if (sEnd && isFinite(sEnd) && sEnd > 0) {
                                setDuration(Math.max(sEnd, cur));
                              }
                            } catch {}
                          } else if (cur > duration) {
                            setDuration(Math.max(cur, fallbackDuration));
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget;
                          const d = v.duration;
                          if (d && isFinite(d) && d > 0) {
                            setDuration(d);
                          } else {
                            // Chromium WebM duration resolution: temporarily seek to end to read true duration
                            if (d === Infinity || !isFinite(d)) {
                              v.currentTime = 1e101;
                              v.ontimeupdate = () => {
                                v.ontimeupdate = null;
                                v.currentTime = 0;
                                if (v.duration && isFinite(v.duration) && v.duration > 0) {
                                  setDuration(v.duration);
                                } else if (fallbackDuration > 0) {
                                  setDuration(fallbackDuration);
                                }
                              };
                            } else if (fallbackDuration > 0) {
                              setDuration(fallbackDuration);
                            }
                          }
                        }}
                        onDurationChange={(e) => {
                          const d = e.currentTarget.duration;
                          if (d && isFinite(d) && d > 0) {
                            setDuration(d);
                          }
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => {
                          setIsPlaying(false);
                        }}
                        playsInline
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c4a35a]/15 border border-[#c4a35a]/30 text-[#dcc084] text-xl">
                          🎥
                        </div>
                        <p className="text-sm font-semibold text-[#f5f5f5]">Video Walkthrough Loading...</p>
                        <p className="text-xs text-[#9a9590] max-w-xs">
                          Connecting to media stream. If not playing, use the step guide on the right.
                        </p>
                      </div>
                    )}

                    {/* Big Overlay Play Button when paused */}
                    {videoSrc && !isPlaying && (
                      <div
                        onClick={handleTogglePlay}
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center cursor-pointer group-hover:bg-black/30 transition"
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#c4a35a] text-[#0a0a0a] shadow-[0_0_50px_rgba(196,163,90,0.5)] transform group-hover:scale-110 transition duration-200">
                          <div className="ml-1.5 w-0 h-0 border-y-[12px] border-y-transparent border-l-[20px] border-l-[#0a0a0a]" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Video Scrubber & Playback Controls Bar */}
                  <div className="rounded-xl border border-white/9 bg-[#121214] p-4 space-y-3 shadow-lg">
                    {/* Interactive Scrubber with Timestamp Chapter Markers */}
                    <div className="space-y-1">
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                          handleSeek(pos * effectiveDuration);
                        }}
                        className="relative h-2.5 rounded-full bg-white/10 cursor-pointer group/scrub"
                      >
                        {/* Played Progress Bar */}
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))}%`,
                          }}
                          className="absolute inset-y-0 left-0 rounded-full bg-[#c4a35a] transition-[width] duration-75"
                        />

                        {/* Gold Scrubber Thumb */}
                        <div
                          style={{
                            left: `${Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))}%`,
                          }}
                          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-[#dcc084] shadow-[0_0_10px_rgba(196,163,90,0.6)] group-hover/scrub:scale-125 transition-transform"
                        />

                        {/* Chapter / Step Tick Markers on Timeline */}
                        {videoSteps.map((step) => {
                          const pct = Math.min(100, Math.max(0, (step.seconds / effectiveDuration) * 100));
                          return (
                            <div
                              key={step.id}
                              style={{ left: `${pct}%` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSeek(step.seconds);
                              }}
                              className="absolute -top-1 h-4.5 w-[2px] bg-white/60 hover:bg-[#c4a35a] hover:w-[4px] -translate-x-1/2 transition-all cursor-pointer"
                              title={`${step.timestamp}: ${step.title}`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Control Buttons */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Play/Pause */}
                        <button
                          type="button"
                          onClick={handleTogglePlay}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084] transition shrink-0"
                          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                        >
                          {isPlaying ? (
                            <div className="flex gap-1">
                              <span className="w-1 h-3.5 bg-black rounded-sm" />
                              <span className="w-1 h-3.5 bg-black rounded-sm" />
                            </div>
                          ) : (
                            <div className="ml-0.5 w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-black" />
                          )}
                        </button>

                        {/* Jump -5s */}
                        <button
                          type="button"
                          onClick={() => handleSkip(-5)}
                          className="rounded-lg border border-white/10 bg-[#181818] px-2.5 py-1.5 text-[11px] font-semibold text-[#cfc9c2] hover:bg-[#222] transition"
                          title="Rewind 5 seconds"
                        >
                          -5s
                        </button>

                        {/* Jump +5s */}
                        <button
                          type="button"
                          onClick={() => handleSkip(5)}
                          className="rounded-lg border border-white/10 bg-[#181818] px-2.5 py-1.5 text-[11px] font-semibold text-[#cfc9c2] hover:bg-[#222] transition"
                          title="Forward 5 seconds"
                        >
                          +5s
                        </button>

                        {/* Time display */}
                        <span className="font-mono text-xs text-[#cfc9c2] whitespace-nowrap pl-1">
                          {formatSeconds(currentTime)} / {formatSeconds(effectiveDuration)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Playback Speed dropdown */}
                        <select
                          value={playbackRate}
                          onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                          className="rounded-lg border border-white/10 bg-[#181818] px-2.5 py-1 text-xs font-semibold text-[#cfc9c2] outline-none cursor-pointer"
                        >
                          <option value="0.75">0.75x</option>
                          <option value="1">1.0x</option>
                          <option value="1.25">1.25x</option>
                          <option value="1.5">1.5x</option>
                          <option value="2">2.0x</option>
                        </select>

                        {/* Mute / Volume */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleToggleMute}
                            className="text-xs text-[#cfc9c2] hover:text-white p-1"
                            title={isMuted ? "Unmute" : "Mute"}
                          >
                            {isMuted || volume === 0 ? "🔇" : "🔊"}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                            className="w-16 sm:w-20 accent-[#c4a35a] h-1.5 cursor-pointer"
                          />
                        </div>

                        {/* Fullscreen */}
                        <button
                          type="button"
                          onClick={handleToggleFullscreen}
                          className="text-xs text-[#cfc9c2] hover:text-white px-2 py-1 rounded bg-[#181818] border border-white/8"
                          title="Fullscreen"
                        >
                          ⛶
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* VA Quick Instructions Tip */}
                  <div className="rounded-xl border border-white/8 bg-[#121214] p-4 flex items-center justify-between gap-3 text-xs text-[#9a9590]">
                    <div className="flex items-center gap-2">
                      <span className="text-[#c4a35a] font-bold">💡 Tip:</span>
                      <span>Click any timestamp on the right to jump the video directly to that step.</span>
                    </div>
                    {videoSrc && (
                      <a
                        href={videoSrc}
                        download={`${sop.slug}.webm`}
                        className="rounded border border-white/10 bg-[#181818] px-2.5 py-1 text-[11px] font-semibold text-[#cfc9c2] hover:text-white whitespace-nowrap"
                      >
                        ⬇ Download
                      </a>
                    )}
                  </div>
                </div>

                {/* Right Column: Synchronized Voice Transcript & Chapter Cards */}
                <div className="lg:col-span-5 xl:col-span-5 space-y-4">
                  {/* Section Title & Progress */}
                  <div className="flex items-center justify-between pb-1 border-b border-white/8">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#f5f5f5] flex items-center gap-2">
                        <span>Voice Transcript &amp; Steps</span>
                        <span className="rounded bg-[#c4a35a]/20 border border-[#c4a35a]/40 px-2 py-0.5 text-[10px] font-mono text-[#dcc084]">
                          {videoSteps.length} {videoSteps.length === 1 ? "Chapter" : "Chapters"}
                        </span>
                      </h3>
                      <p className="text-[11.5px] text-[#6f6a65]">
                        {completedCount} of {videoSteps.length} steps verified
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetProgress}
                      className="text-xs text-[#6f6a65] hover:text-[#c4a35a] underline"
                    >
                      Reset checklist
                    </button>
                  </div>

                  {/* Transcript & Step List */}
                  <div className="space-y-3.5">
                    {videoSteps.map((step, idx) => {
                      const isActive = activeStepId === step.id;
                      const isChecked = Boolean(completedSteps[step.id]);

                      return (
                        <div
                          key={step.id || idx}
                          ref={(el) => {
                            stepCardRefs.current[step.id] = el;
                          }}
                          className={`group relative rounded-xl border p-4 sm:p-5 transition-all duration-200 shadow-md ${
                            isActive
                              ? "border-[#c4a35a] bg-[#1a1712] shadow-[0_0_25px_rgba(196,163,90,0.18)] ring-1 ring-[#c4a35a]/50"
                              : isChecked
                              ? "border-white/6 bg-[#0e0e0e] opacity-75"
                              : "border-white/10 bg-[#121214] hover:border-white/20"
                          }`}
                        >
                          {/* Active Indicator Top Pill */}
                          {isActive && (
                            <div className="absolute -top-2.5 right-4 rounded-full bg-[#c4a35a] px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-black shadow-md flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-black animate-ping" />
                              NOW PLAYING
                            </div>
                          )}

                          <div className="flex items-start gap-3.5">
                            {/* Verified Checkbox */}
                            <button
                              type="button"
                              onClick={() => handleToggleStep(step.id)}
                              className={`flex h-5 w-5 items-center justify-center rounded border transition shrink-0 mt-0.5 ${
                                isChecked
                                  ? "bg-[#4ea882] border-[#4ea882] text-black font-bold text-xs"
                                  : "border-white/25 bg-[#0a0a0a] hover:border-[#c4a35a]"
                              }`}
                              title={isChecked ? "Mark as uncompleted" : "Mark as completed"}
                            >
                              {isChecked ? "✓" : ""}
                            </button>

                            <div className="flex-1 min-w-0 space-y-2.5">
                              {/* Top Bar: Timestamp Jump Button + Step Number */}
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleJumpStep(step)}
                                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs font-bold transition shadow-sm ${
                                    isActive
                                      ? "bg-[#c4a35a] text-[#0a0a0a]"
                                      : "bg-[#c4a35a]/15 border border-[#c4a35a]/35 text-[#dcc084] hover:bg-[#c4a35a] hover:text-[#0a0a0a]"
                                  }`}
                                  title="Jump video to this timestamp"
                                >
                                  <span>▶</span>
                                  <span>{step.timestamp}</span>
                                </button>

                                <span className="font-mono text-[10.5px] text-[#6f6a65] font-semibold">
                                  STEP 0{step.step_number || idx + 1}
                                </span>
                              </div>

                              {/* Title */}
                              <h4
                                onClick={() => handleJumpStep(step)}
                                className={`text-[15px] font-bold tracking-tight cursor-pointer ${
                                  isChecked
                                    ? "line-through text-[#9a9590]"
                                    : isActive
                                    ? "text-white"
                                    : "text-[#f5f5f5] hover:text-[#dcc084]"
                                }`}
                              >
                                {step.title}
                              </h4>

                              {/* Description */}
                              <p className="text-xs sm:text-[13px] text-[#cfc9c2] leading-relaxed whitespace-pre-line">
                                {step.description}
                              </p>

                              {/* Copyable Script Template */}
                              {step.copy_snippets?.[0] && (
                                <div className="rounded-lg border border-[#c4a35a]/30 overflow-hidden bg-[#0a0a0a] mt-2">
                                  <div className="flex items-center justify-between bg-[#161310] px-3 py-1.5 border-b border-[#c4a35a]/20">
                                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#c4a35a]">
                                      {step.copy_snippets[0].title || "Script Template"}
                                    </span>
                                  </div>
                                  <div className="p-2.5 font-mono text-xs text-[#f5f5f5] leading-relaxed whitespace-pre-wrap">
                                    {step.copy_snippets[0].template}
                                  </div>
                                  <div className="flex justify-end p-2 bg-[#0f0f0f] border-t border-white/6">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopyScript(
                                          step.copy_snippets![0].template,
                                          step.copy_snippets![0].id
                                        )
                                      }
                                      className={`rounded px-3 py-1 text-xs font-bold transition ${
                                        copiedScriptId === step.copy_snippets[0].id
                                          ? "bg-[#4ea882] text-black"
                                          : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                                      }`}
                                    >
                                      {copiedScriptId === step.copy_snippets[0].id
                                        ? "✓ Copied"
                                        : "Copy Script"}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Pro Tip */}
                              {step.pro_tip && (
                                <div className="rounded-r-md border-l-2 border-l-[#c4a35a] bg-[#c4a35a]/5 p-2.5 text-xs text-[#cfc9c2]">
                                  <span className="font-bold uppercase tracking-wider text-[#c4a35a] mr-1.5">
                                    Pro tip:
                                  </span>
                                  {step.pro_tip}
                                </div>
                              )}

                              {/* Warning */}
                              {step.warning && (
                                <div className="rounded-r-md border-l-2 border-l-[#c0603c] bg-[#c0603c]/5 p-2.5 text-xs text-[#cfc9c2]">
                                  <span className="font-bold uppercase tracking-wider text-[#d98a63] mr-1.5">
                                    Careful:
                                  </span>
                                  {step.warning}
                                </div>
                              )}

                              {/* Screenshot Zoom */}
                              {step.image_url && (
                                <div
                                  onClick={() =>
                                    setLightboxImg({ src: step.image_url!, title: step.title })
                                  }
                                  className="relative rounded-md border border-white/10 overflow-hidden cursor-zoom-in bg-[#151515] mt-2 group/img"
                                >
                                  <img
                                    src={step.image_url}
                                    alt={step.title}
                                    className="w-full max-h-56 object-contain"
                                  />
                                  <div className="absolute right-2 bottom-2 rounded bg-black/85 px-2 py-0.5 text-[10px] text-[#9a9590] group-hover/img:text-white">
                                    ⤢ Zoom
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: FULL DOCUMENT CHECKLIST VIEW                                      */}
          {/* ========================================================================= */}
          {viewMode === "doc" && (
            <div className="max-w-3xl space-y-6">
              {/* Header Meta */}
              <div>
                <div className="flex items-center gap-2.5 text-xs text-[#6f6a65] mb-3">
                  <span className="rounded bg-[#c4a35a]/10 border border-[#c4a35a]/30 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase text-[#c4a35a]">
                    {sop.category}
                  </span>
                  <span>{sop.estimated_minutes} min read</span>
                  <span>·</span>
                  <span>Role: {sop.target_role.toUpperCase()}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f5f5f5] leading-tight">
                  {sop.title}
                </h1>
              </div>

              {/* Objective Box */}
              {sop.summary && (
                <div className="rounded-r-lg border-y border-r border-white/8 border-l-2 border-l-[#c4a35a] bg-[#121212] p-5 space-y-1.5 shadow-md">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                    Objective
                  </span>
                  <p className="text-sm text-[#cfc9c2] leading-relaxed">{sop.summary}</p>
                </div>
              )}

              {/* Video Walkthrough Player if present */}
              {isVideoSop && videoSrc && (
                <div className="rounded-xl border border-white/10 bg-[#121214] p-5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#c4a35a]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#c4a35a]">
                        Video Walkthrough &amp; Voice Guide
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-[#9a9590]">1080P HD · AUDIO</span>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-white/8 bg-black">
                    <video
                      src={videoSrc}
                      controls
                      playsInline
                      className="w-full max-h-[440px] object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Progress Bar with Reset */}
              <div className="flex items-center gap-4 rounded-lg border border-white/8 bg-[#0f0f0f] px-5 py-3.5 shadow-sm">
                <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full bg-[#4ea882] rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#9a9590] whitespace-nowrap">
                  {completedCount} of {stepsList.length} completed ({progressPct}%)
                </span>
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="text-xs text-[#6f6a65] hover:text-[#c4a35a] underline"
                >
                  Reset
                </button>
              </div>

              {/* Step Cards List */}
              <div className="space-y-5">
                {videoSteps.map((step, idx) => {
                  const isChecked = Boolean(completedSteps[step.id]);

                  return (
                    <div
                      key={step.id || idx}
                      className={`flex gap-4 rounded-lg border p-6 transition shadow-md ${
                        isChecked
                          ? "border-white/6 bg-[#0f0f0f] opacity-75"
                          : "border-white/10 bg-[#121212]"
                      }`}
                    >
                      {/* Checkbox + Step Number */}
                      <div className="flex flex-col items-center gap-3 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStep(step.id)}
                          className={`flex h-6 w-6 items-center justify-center rounded border transition ${
                            isChecked
                              ? "bg-[#4ea882] border-[#4ea882] text-black font-bold text-xs"
                              : "border-white/20 bg-[#0a0a0a] hover:border-[#c4a35a]"
                          }`}
                        >
                          {isChecked ? "✓" : ""}
                        </button>
                        <span className="font-mono text-[10px] text-[#4d4a47]">
                          0{step.step_number || idx + 1}
                        </span>
                      </div>

                      {/* Step Main Body */}
                      <div className="flex-1 space-y-4 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c4a35a]">
                              Step {step.step_number || idx + 1}
                            </span>
                            <h3
                              className={`text-lg font-bold tracking-tight text-[#f5f5f5] ${
                                isChecked ? "line-through text-[#9a9590]" : ""
                              }`}
                            >
                              {step.title}
                            </h3>
                          </div>
                          {isVideoSop && step.timestamp && (
                            <span className="rounded bg-[#c4a35a]/15 border border-[#c4a35a]/30 px-2.5 py-1 font-mono text-xs font-bold text-[#dcc084]">
                              {step.timestamp}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5 text-sm text-[#cfc9c2] leading-relaxed whitespace-pre-line">
                          {step.description}
                        </div>

                        {/* Screenshot Preview */}
                        {step.image_url && (
                          <div className="space-y-3">
                            <div
                              onClick={() =>
                                setLightboxImg({ src: step.image_url!, title: step.title })
                              }
                              className="relative rounded-md border border-white/10 overflow-hidden cursor-zoom-in bg-[#151515] group"
                            >
                              <img
                                src={step.image_url}
                                alt={step.title}
                                className="w-full max-h-96 object-contain"
                              />
                              <div className="absolute right-3 bottom-3 rounded bg-black/85 border border-white/12 px-2.5 py-1 text-[10.5px] font-semibold text-[#9a9590] group-hover:text-white transition">
                                ⤢ Click to zoom
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Copyable Script Snippet */}
                        {step.copy_snippets?.[0] && (
                          <div className="rounded-md border border-[#c4a35a]/25 overflow-hidden">
                            <div className="flex items-center justify-between bg-[#161310] px-3.5 py-2 border-b border-[#c4a35a]/20">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#c4a35a]">
                                {step.copy_snippets[0].title || "Script Template"}
                              </span>
                              <span className="font-mono text-[10.5px] text-[#6f6a65]">
                                fill the {"{variables}"}
                              </span>
                            </div>
                            <div className="p-3.5 bg-[#0a0a0a] font-mono text-xs text-[#e8e4de] leading-relaxed whitespace-pre-wrap">
                              {step.copy_snippets[0].template}
                            </div>
                            <div className="flex justify-end p-2 bg-[#0f0f0f] border-t border-white/6">
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyScript(
                                    step.copy_snippets![0].template,
                                    step.copy_snippets![0].id
                                  )
                                }
                                className={`rounded px-3.5 py-1 text-xs font-bold transition ${
                                  copiedScriptId === step.copy_snippets[0].id
                                    ? "bg-[#4ea882] text-black"
                                    : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                                }`}
                              >
                                {copiedScriptId === step.copy_snippets[0].id
                                  ? "✓ Copied"
                                  : "Copy Script"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Pro Tip */}
                        {step.pro_tip && (
                          <div className="flex items-start gap-3 rounded-r-md border-l-2 border-l-[#c4a35a] bg-[#c4a35a]/5 p-3.5 text-xs text-[#cfc9c2]">
                            <span className="font-bold uppercase tracking-wider text-[#c4a35a] shrink-0">
                              Pro tip:
                            </span>
                            <span className="leading-relaxed">{step.pro_tip}</span>
                          </div>
                        )}

                        {/* Warning */}
                        {step.warning && (
                          <div className="flex items-start gap-3 rounded-r-md border-l-2 border-l-[#c0603c] bg-[#c0603c]/5 p-3.5 text-xs text-[#cfc9c2]">
                            <span className="font-bold uppercase tracking-wider text-[#d98a63] shrink-0">
                              Careful:
                            </span>
                            <span className="leading-relaxed">{step.warning}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Switch to Guide Mode Banner */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-white/8 bg-[#121212] p-5 shadow-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#f5f5f5]">
                    Prefer to be walked through step-by-step?
                  </span>
                  <span className="text-xs text-[#9a9590]">
                    Guide Me mode shows one step at a time with scripts ready to copy.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode("guide")}
                  className="rounded bg-[#c4a35a] px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition shrink-0"
                >
                  Start Guide Me →
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 3: INTERACTIVE "GUIDE ME" STEP-BY-STEP MODE                          */}
          {/* ========================================================================= */}
          {viewMode === "guide" && (
            <div className="max-w-3xl pb-16">
              {!guideFinished && videoSteps[guideStepIdx] && (
                <div className="space-y-6">
                  {/* Top Progress Bar */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1.5 rounded-full bg-[#161616] overflow-hidden">
                      <div
                        className="h-full bg-[#c4a35a] rounded-full transition-all duration-300"
                        style={{ width: `${guidePct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#c4a35a]">
                      Step {guideStepIdx + 1} of {videoSteps.length} ({guidePct}%)
                    </span>
                  </div>

                  {/* Active Step Card */}
                  <div className="rounded-xl border border-white/10 bg-[#121212] p-6 sm:p-8 space-y-6 shadow-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#c4a35a]">
                          Step 0{guideStepIdx + 1}
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f5f5f5] mt-1">
                          {videoSteps[guideStepIdx].title}
                        </h2>
                      </div>
                      {isVideoSop && videoSteps[guideStepIdx].timestamp && (
                        <span className="rounded bg-[#c4a35a]/15 border border-[#c4a35a]/35 px-3 py-1 font-mono text-xs font-bold text-[#dcc084]">
                          {videoSteps[guideStepIdx].timestamp}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-[#cfc9c2] leading-relaxed whitespace-pre-line">
                      {videoSteps[guideStepIdx].description}
                    </div>

                    {/* Screenshot */}
                    {videoSteps[guideStepIdx].image_url && (
                      <div
                        onClick={() =>
                          setLightboxImg({
                            src: videoSteps[guideStepIdx].image_url!,
                            title: videoSteps[guideStepIdx].title,
                          })
                        }
                        className="relative rounded-lg border border-white/10 overflow-hidden cursor-zoom-in bg-[#151515]"
                      >
                        <img
                          src={videoSteps[guideStepIdx].image_url}
                          alt={videoSteps[guideStepIdx].title}
                          className="w-full max-h-[440px] object-contain"
                        />
                      </div>
                    )}

                    {/* Script Snippet */}
                    {videoSteps[guideStepIdx].copy_snippets?.[0] && (
                      <div className="rounded-lg border border-[#c4a35a]/30 overflow-hidden">
                        <div className="flex items-center justify-between bg-[#161310] px-4 py-2.5 border-b border-[#c4a35a]/20">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#c4a35a]">
                            {videoSteps[guideStepIdx].copy_snippets[0].title || "Message Template"}
                          </span>
                          <span className="font-mono text-[10px] text-[#9a9590]">
                            fill the {"{variables}"}
                          </span>
                        </div>
                        <div className="p-4 bg-[#0a0a0a] font-mono text-xs text-[#f5f5f5] leading-relaxed whitespace-pre-wrap">
                          {videoSteps[guideStepIdx].copy_snippets[0].template}
                        </div>
                        <div className="flex justify-end p-2.5 bg-[#0f0f0f] border-t border-white/6">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyScript(
                                videoSteps[guideStepIdx].copy_snippets![0].template,
                                videoSteps[guideStepIdx].copy_snippets![0].id
                              )
                            }
                            className={`rounded px-4 py-1.5 text-xs font-bold transition ${
                              copiedScriptId === videoSteps[guideStepIdx].copy_snippets[0].id
                                ? "bg-[#4ea882] text-black"
                                : "bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084]"
                            }`}
                          >
                            {copiedScriptId === videoSteps[guideStepIdx].copy_snippets[0].id
                              ? "✓ Copied to Clipboard"
                              : "Copy Script"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pro Tip */}
                    {videoSteps[guideStepIdx].pro_tip && (
                      <div className="rounded-r-md border-l-2 border-l-[#c4a35a] bg-[#c4a35a]/5 p-3.5 text-xs text-[#cfc9c2]">
                        <span className="font-bold uppercase tracking-wider text-[#c4a35a] mr-2">
                          Pro tip:
                        </span>
                        {videoSteps[guideStepIdx].pro_tip}
                      </div>
                    )}
                  </div>

                  {/* Sticky Player Bottom Navigation Bar */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/8">
                    <button
                      type="button"
                      onClick={() => setGuideStepIdx((prev) => Math.max(0, prev - 1))}
                      disabled={guideStepIdx === 0}
                      className="rounded border border-white/10 px-4 py-2 text-xs font-semibold text-[#9a9590] hover:text-[#f5f5f5] disabled:opacity-30"
                    >
                      ← Previous Step
                    </button>

                    <span className="font-mono text-xs text-[#6f6a65]">
                      Step {guideStepIdx + 1} of {videoSteps.length}
                    </span>

                    {guideStepIdx < videoSteps.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleStep(videoSteps[guideStepIdx].id);
                          setGuideStepIdx((prev) => prev + 1);
                        }}
                        className="rounded bg-[#c4a35a] px-5 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition"
                      >
                        Next Step →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleStep(videoSteps[guideStepIdx].id);
                          setGuideFinished(true);
                        }}
                        className="rounded bg-[#4ea882] px-5 py-2 text-xs font-bold text-black hover:bg-[#5fc497] transition"
                      >
                        Complete SOP ✓
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Guide Completion Celebration Screen */}
              {guideFinished && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121212] p-12 text-center space-y-5 animate-fade-in shadow-2xl">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4ea882]/20 text-[#4ea882] text-2xl font-bold border border-[#4ea882]/40">
                    ✓
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#f5f5f5]">SOP Completed</h2>
                    <p className="text-sm text-[#9a9590] mt-1">
                      You completed all {videoSteps.length} steps in {sop.title}.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGuideStepIdx(0);
                        setGuideFinished(false);
                      }}
                      className="rounded border border-white/10 bg-[#1a1a1a] px-5 py-2 text-xs font-semibold text-[#f5f5f5] hover:bg-[#222]"
                    >
                      Restart Walkthrough
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* Screenshot Zoom Lightbox Modal */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 backdrop-blur-md p-6 cursor-zoom-out animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-6xl overflow-hidden rounded-lg border border-white/10 bg-[#0e0e0e] shadow-2xl p-2"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 mb-2">
              <span className="text-xs font-semibold text-[#cfc9c2]">{lightboxImg.title}</span>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="text-xs font-bold text-[#9a9590] hover:text-[#f5f5f5]"
              >
                ✕ Close
              </button>
            </div>
            <img
              src={lightboxImg.src}
              alt={lightboxImg.title}
              className="max-h-[80vh] w-auto object-contain mx-auto rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}
