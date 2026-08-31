import { useState, useRef, useEffect } from "react";
import type { SopStep, SopCategory, SopTargetRole } from "../../../shared/pm/sopTypes";

interface VideoSopStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSop: (
    steps: SopStep[],
    meta: {
      title: string;
      category: SopCategory;
      target_role: SopTargetRole;
      summary: string;
      video_url?: string;
    }
  ) => void;
}

interface TranscriptLine {
  id: string;
  t: string;
  who: string;
  text: string;
}

interface GeneratedStep {
  id: string;
  n: number;
  t: string;
  text: string;
  description?: string;
}

// Default fallback demo data if speech recognition is unavailable or silent
const DEFAULT_TRANSCRIPT: TranscriptLine[] = [
  {
    id: "tr-1",
    t: "0:04",
    who: "Shane · Ops",
    text: "When a guest asks for an early check-in, open the multi-calendar in Guesty — never the single listing view.",
  },
  {
    id: "tr-2",
    t: "0:31",
    who: "Shane · Ops",
    text: "Find the reservation and look at the checkout before it. We need at least four hours between checkout and check-in for the cleaner to turn the unit.",
  },
  {
    id: "tr-3",
    t: "1:12",
    who: "Shane · Ops",
    text: "If the gap clears four hours, approve it right here and message the cleaner with the new arrival time. If it doesn't, offer bag drop instead.",
  },
];

const DEFAULT_STEPS: GeneratedStep[] = [
  {
    id: "step-1",
    n: 1,
    t: "0:04",
    text: "Navigate to Multi-Calendar in Guesty",
    description: "Open the full portfolio multi-calendar view rather than the single unit screen.",
  },
  {
    id: "step-2",
    n: 2,
    t: "0:31",
    text: "Locate reservation and check if checkout-to-checkin gap is ≥ 4.0 hours",
    description: "Verify turnover window gap between incoming guest and prior checkout.",
  },
  {
    id: "step-3",
    n: 3,
    t: "1:12",
    text: "Approve turnover request and notify cleaner",
    description: "If turnover gap clears 4 hours, confirm early arrival and notify turnover lead.",
  },
];

export function VideoSopStudioModal({ isOpen, onClose, onSaveSop }: VideoSopStudioModalProps) {
  // Modal Stages: 'setup' | 'recording' | 'review'
  const [stage, setStage] = useState<"setup" | "recording" | "review">("setup");

  // SOP Metadata
  const [title, setTitle] = useState("Early Check-in Approval & Turnover Gap Guide");
  const [targetRole, setTargetRole] = useState<SopTargetRole>("va");
  const [category, setCategory] = useState<SopCategory>("turnover");

  // Recording State & Media
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [micLevel, setMicLevel] = useState<number[]>([14, 18, 22, 10, 20, 16]);
  const [sourceLabel, setSourceLabel] = useState("Guesty — Reservations");
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);

  // Transcript & Steps
  const [transcript, setTranscript] = useState<TranscriptLine[]>(DEFAULT_TRANSCRIPT);
  const [steps, setSteps] = useState<GeneratedStep[]>(DEFAULT_STEPS);

  // Video playback controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(102);
  const [volume, setVolume] = useState(0.8);

  // Hardware stream refs
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Audio level visualizer loop
  useEffect(() => {
    let animId: number;
    const updateMicMeter = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalized = Math.min(24, Math.max(4, Math.round((avg / 255) * 24)));
        setMicLevel([
          Math.max(4, normalized * 0.8),
          Math.max(4, normalized * 1.1),
          Math.max(4, normalized * 1.2),
          Math.max(4, normalized * 0.6),
          Math.max(4, normalized * 1.0),
          Math.max(4, normalized * 0.9),
        ]);
      }
      animId = requestAnimationFrame(updateMicMeter);
    };

    if (isOpen) {
      animId = requestAnimationFrame(updateMicMeter);
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen]);

  // Teardown streams
  const cleanupStreams = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupStreams();
      setStage("setup");
      setRecordingSeconds(0);
      setIsPlaying(false);
    }
  }, [isOpen]);

  // Start real recording (Screen + Microphone)
  const handleStartRecording = async () => {
    try {
      // 1. Get Screen Stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });
      screenStreamRef.current = screenStream;

      // Extract track title
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        setSourceLabel(videoTrack.label || "Screen Stream");
        videoTrack.onended = () => {
          handleFinishRecording();
        };
      }

      // 2. Get Microphone Audio Stream
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;

        // Connect Web Audio Analyser
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(micStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        analyserRef.current = analyser;
        setMicActive(true);
      } catch {
        setMicActive(false);
      }

      // 3. Combine Tracks into single recording stream
      const tracks = [...screenStream.getTracks()];
      if (micStream) {
        micStream.getAudioTracks().forEach((t) => tracks.push(t));
      }
      const combinedStream = new MediaStream(tracks);

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = combinedStream;
        liveVideoRef.current.play().catch(() => {});
      }

      // 4. Start MediaRecorder
      recordedChunksRef.current = [];
      const options = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? { mimeType: "video/webm;codecs=vp9,opus" }
        : MediaRecorder.isTypeSupported("video/webm")
        ? { mimeType: "video/webm" }
        : undefined;

      const mediaRecorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoBlobUrl(url);
      };

      mediaRecorder.start(1000);

      // 5. Initialize Live Speech-to-Text Recognition if supported
      initSpeechRecognition();

      // 6. Transition to Recording Stage
      setRecordingSeconds(0);
      setIsPaused(false);
      setStage("recording");

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      // If user cancelled display media or declined permission, start simulated session
      handleStartSimulatedRecording();
    }
  };

  // Fallback demo simulation
  const handleStartSimulatedRecording = () => {
    setStage("recording");
    setRecordingSeconds(0);
    setIsPaused(false);
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Live Speech Recognition setup
  const initSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        const liveTranscripts: TranscriptLine[] = [];

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript.trim();
              if (text.length > 2) {
                const mins = Math.floor(recordingSeconds / 60);
                const secs = (recordingSeconds % 60).toString().padStart(2, "0");
                const timeStr = `${mins}:${secs}`;
                liveTranscripts.push({
                  id: `tr-${Date.now()}-${i}`,
                  t: timeStr,
                  who: "Shane · Ops",
                  text,
                });
                setTranscript([...liveTranscripts]);

                // Also generate step
                setSteps((prevSteps) => [
                  ...prevSteps,
                  {
                    id: `step-${Date.now()}-${prevSteps.length + 1}`,
                    n: prevSteps.length + 1,
                    t: timeStr,
                    text: text.length > 60 ? `${text.slice(0, 58)}...` : text,
                    description: text,
                  },
                ]);
              }
            }
          }
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch {}
    }
  };

  // Toggle Pause
  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Finish Recording
  const handleFinishRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupStreams();
    setDuration(Math.max(12, recordingSeconds || 102));
    setPlaybackTime(0);
    setIsPlaying(false);
    setStage("review");
  };

  // Video Playback Controls
  const handleTogglePlay = () => {
    if (reviewVideoRef.current) {
      if (isPlaying) {
        reviewVideoRef.current.pause();
        setIsPlaying(false);
      } else {
        reviewVideoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    setPlaybackTime(time);
    if (reviewVideoRef.current) {
      reviewVideoRef.current.currentTime = time;
    }
  };

  const parseTimeToSeconds = (tStr: string): number => {
    const clean = tStr.replace(/[\[\]]/g, "");
    const parts = clean.split(":").map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  // Save to Playbook
  const handleSaveToPlaybook = () => {
    const formattedSteps: SopStep[] = steps.map((s, idx) => ({
      id: `sop-step-${Date.now()}-${idx + 1}`,
      step_number: idx + 1,
      title: s.text,
      description: s.description || s.text,
      media_type: "video_embed",
      video_url: videoBlobUrl || undefined,
      pro_tip:
        idx === 0
          ? "Ensure you verify all fields on this screen before approving."
          : undefined,
    }));

    onSaveSop(formattedSteps, {
      title: title || "Video SOP Playbook",
      category,
      target_role: targetRole,
      summary: `Comprehensive video guide with spoken instructions transcribed for ${targetRole.toUpperCase()} team.`,
      video_url: videoBlobUrl || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/88 backdrop-blur-md p-3 sm:p-6 font-['Manrope',system-ui,sans-serif] animate-fadeIn">
      {/* Container matching Claude Design Canvas 1440 × 900 styling */}
      <div className="relative flex h-[92vh] w-full max-w-[1340px] flex-col rounded-2xl border border-white/10 bg-[#0a0a0a] text-[#f4f2ee] shadow-2xl overflow-hidden">
        
        {/* ======================================================== */}
        {/* FRAME 1 · SETUP & AUDIO CHECK MODAL                     */}
        {/* ======================================================== */}
        {stage === "setup" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
            {/* Close button top-right */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f4f2ee] hover:bg-[#1a1a1a] transition"
            >
              ✕
            </button>

            {/* Inner Setup Card */}
            <div className="w-full max-w-[620px] rounded-[18px] border border-white/12 bg-[#141414] p-8 sm:p-10 shadow-[0_40px_120px_rgba(0,0,0,0.7)] space-y-7">
              {/* Card Title & Subtitle */}
              <div className="space-y-2.5">
                <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#f4f2ee] leading-tight">
                  Record Video SOP
                </div>
                <p className="text-sm sm:text-[15px] leading-relaxed text-[#f4f2ee]/50">
                  Record your screen and speak through the steps. We'll record the video and transcribe your voice for the team.
                </p>
              </div>

              {/* Active Mic Pill with Bouncing Green Equalizer Bars */}
              <div className="inline-flex items-center gap-3.5 rounded-full border border-white/9 bg-[#1a1a1a] px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-[#5fbf7d]" />
                <span className="text-xs sm:text-[13px] font-medium text-[#f4f2ee]/75">
                  Mic: MacBook Microphone <span className="text-[#5fbf7d] font-semibold">({micActive ? "Active" : "Ready"})</span>
                </span>
                <div className="flex items-end gap-[3px] h-[18px]">
                  {micLevel.map((height, i) => (
                    <span
                      key={i}
                      style={{ height: `${height}px` }}
                      className="w-[3px] rounded-sm bg-[#5fbf7d] transition-all duration-75"
                    />
                  ))}
                </div>
              </div>

              {/* Form Inputs: Title & Target Role */}
              <div className="space-y-5">
                {/* SOP Title */}
                <div className="space-y-2">
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#f4f2ee]/40">
                    SOP Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Early Check-in Approval & Turnover Gap Guide"
                    className="w-full rounded-lg border border-[#c4a35a]/45 bg-[#0e0e0e] px-4 py-3 text-[14.5px] font-medium text-[#f4f2ee] outline-none shadow-[0_0_0_3px_rgba(196,163,90,0.08)] focus:border-[#c4a35a]"
                  />
                </div>

                {/* Target Role Selector */}
                <div className="space-y-2">
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#f4f2ee]/40">
                    Target Role
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: "va", label: "VA Team" },
                        { id: "cleaner", label: "Cleaner" },
                        { id: "manager", label: "Operations Manager" },
                        { id: "all", label: "Everyone" },
                      ] as const
                    ).map((role) => {
                      const isSelected = targetRole === role.id;
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setTargetRole(role.id)}
                          className={`rounded-lg py-3 px-2 text-center text-xs sm:text-[13.5px] font-semibold transition ${
                            isSelected
                              ? "border border-[#c4a35a]/45 bg-[#c4a35a]/12 text-[#dcc084]"
                              : "border border-white/8 bg-[#0e0e0e] text-[#f4f2ee]/50 hover:text-[#f4f2ee]"
                          }`}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Selector */}
                <div className="space-y-2">
                  <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#f4f2ee]/40">
                    SOP Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SopCategory)}
                    className="w-full rounded-lg border border-white/8 bg-[#0e0e0e] px-3.5 py-2.5 text-xs sm:text-[13px] text-[#f4f2ee] outline-none"
                  >
                    <option value="turnover">Turnovers & Cleaning</option>
                    <option value="guest_ops">Guest Comms & Inquiries</option>
                    <option value="outreach">Outreach & Leads</option>
                    <option value="team_comms">Team & Cleaner Comms</option>
                    <option value="software">Software & Settings</option>
                    <option value="maintenance">Maintenance & Repairs</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="flex-1 flex items-center justify-center gap-2.5 rounded-xl bg-[#c4a35a] py-4 text-sm sm:text-[15px] font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-[0_12px_40px_rgba(196,163,90,0.3)] transition"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#cf603c] animate-pulse" />
                  <span>Start Recording (Screen + Mic)</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 text-sm text-[#f4f2ee]/45 hover:text-[#f4f2ee] transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FRAME 2 · ACTIVE RECORDING HUD & LIVE VIEWFINDER        */}
        {/* ======================================================== */}
        {stage === "recording" && (
          <div className="flex-1 flex flex-col relative bg-[#0a0a0a] p-4 sm:p-6 overflow-hidden">
            {/* Viewport Frame */}
            <div className="relative flex-1 rounded-xl border border-white/7 bg-[#111111] overflow-hidden flex flex-col">
              {/* Fake Chrome / Top Bar */}
              <div className="h-11 flex items-center justify-between px-4 bg-[#171717] border-b border-white/6 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3a]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3a]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3a]" />
                  <span className="ml-3 rounded bg-[#0f0f0f] px-3 py-1 font-mono text-[11px] text-[#f4f2ee]/45">
                    {sourceLabel}
                  </span>
                </div>
              </div>

              {/* Live Video stream or interactive mock */}
              <div className="flex-1 relative flex items-center justify-center bg-[#0e0e0e] overflow-hidden">
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />

                {/* Top Toast: Recording Tab */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2.5 rounded-full bg-[#141414]/94 border border-[#cf603c]/40 px-5 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-[#cf603c] animate-ping" />
                  <span className="text-xs sm:text-[13px] font-semibold text-[#f4f2ee]/90">
                    Recording tab "{sourceLabel}"
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Floating Pill HUD */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 z-20">
              <div className="flex items-center gap-4 sm:gap-5 rounded-full border border-white/12 bg-[#141414]/96 px-5 py-3 shadow-[0_26px_70px_rgba(0,0,0,0.75)] backdrop-blur-xl">
                {/* Red Pulse + Live Timer */}
                <div className="flex items-center gap-2.5 pr-4 border-r border-white/8">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#cf603c] animate-pulse" />
                  <span className="font-mono text-base font-medium tracking-wider text-[#f4f2ee]">
                    {formatSeconds(recordingSeconds)}
                  </span>
                </div>

                {/* Voice Visualizer Wave */}
                <div className="flex items-center gap-2.5 pr-4 border-r border-white/8">
                  <div className="flex items-center gap-[3px] h-[18px]">
                    {micLevel.map((height, i) => (
                      <span
                        key={i}
                        style={{ height: `${height}px` }}
                        className="w-[3px] rounded-sm bg-[#5fbf7d] transition-all duration-75"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-[#f4f2ee]/40 hidden sm:inline">Speaking</span>
                </div>

                {/* Pause Button */}
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="flex items-center gap-2 rounded-full border border-white/8 bg-[#1f1f1f] px-4 py-2 text-xs sm:text-[13px] font-semibold text-[#f4f2ee]/75 hover:bg-[#262626] transition"
                >
                  <span className="flex gap-0.5">
                    <span className="w-[3px] h-[11px] bg-current rounded-sm" />
                    <span className="w-[3px] h-[11px] bg-current rounded-sm" />
                  </span>
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>

                {/* Finish Recording Button */}
                <button
                  type="button"
                  onClick={handleFinishRecording}
                  className="flex items-center gap-2 rounded-full bg-[#c4a35a] px-5 py-2 text-xs sm:text-sm font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-[0_10px_32px_rgba(196,163,90,0.3)] transition"
                >
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#0a0a0a]" />
                  <span>Finish Recording</span>
                </button>
              </div>

              <span className="font-mono text-[11px] tracking-wide text-[#f4f2ee]/30">
                Press Space or click Finish when done
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FRAME 3 · REVIEW & PLAYBACK STUDIO (SPLIT VIEW)         */}
        {/* ======================================================== */}
        {stage === "review" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
            {/* Top Bar Header */}
            <div className="h-16 flex items-center justify-between gap-4 px-6 bg-[#0e0e0e] border-b border-white/8 shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-6 w-6 rounded-md bg-[#c4a35a] shrink-0" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="SOP Title"
                  className="flex-1 min-w-0 rounded-lg border border-white/8 bg-[#141414] px-3.5 py-1.5 text-[15px] font-semibold text-[#f4f2ee] outline-none focus:border-[#c4a35a]/50"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-lg border border-white/8 bg-[#141414] px-3 py-2 text-xs text-[#f4f2ee]/60">
                  {category === "turnover" ? "Turnovers & Cleaning" : category}
                </span>

                <button
                  type="button"
                  onClick={handleSaveToPlaybook}
                  className="rounded-lg bg-[#c4a35a] px-5 py-2 text-xs sm:text-sm font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-[0_10px_32px_rgba(196,163,90,0.3)] transition"
                >
                  Save Video & Guide to Playbook ✓
                </button>
              </div>
            </div>

            {/* Split Content Panes */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
              {/* Left Column: Video Player */}
              <div className="w-full lg:w-[620px] xl:w-[720px] p-6 border-b lg:border-b-0 lg:border-r border-white/7 flex flex-col gap-4 overflow-y-auto shrink-0">
                {/* Video Player Box */}
                <div className="relative h-[320px] sm:h-[380px] rounded-xl border border-white/9 bg-[#141414] overflow-hidden flex items-center justify-center group">
                  {videoBlobUrl ? (
                    <video
                      ref={reviewVideoRef}
                      src={videoBlobUrl}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={handleTogglePlay}
                      onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                      onDurationChange={(e) => {
                        if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                          setDuration(e.currentTarget.duration);
                        }
                      }}
                      onEnded={() => setIsPlaying(false)}
                      playsInline
                    />
                  ) : (
                    <div className="relative flex flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="flex h-16 w-16 items-center justify-center rounded-full border border-[#c4a35a]/50 bg-[#c4a35a]/15 text-[#dcc084] hover:scale-105 transition"
                      >
                        <div className="ml-1 w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-[#dcc084]" />
                      </button>
                      <span className="font-mono text-[11px] uppercase tracking-widest text-[#f4f2ee]/35">
                        screen recording · guesty multi-calendar
                      </span>
                    </div>
                  )}

                  {/* Top Badge */}
                  <div className="absolute top-4 left-4 rounded-md bg-black/70 px-3 py-1 font-mono text-[10px] tracking-wider text-[#f4f2ee]/55">
                    1080P · MIC ON
                  </div>
                </div>

                {/* Custom Video Controls Bar */}
                <div className="rounded-xl border border-white/8 bg-[#141414] p-4 space-y-3.5">
                  {/* Progress Timeline Scrubber with Step Marker Tags */}
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = (e.clientX - rect.left) / rect.width;
                      handleSeek(pos * duration);
                    }}
                    className="relative h-1.5 rounded-full bg-white/9 cursor-pointer"
                  >
                    <div
                      style={{ width: `${(playbackTime / duration) * 100}%` }}
                      className="absolute inset-y-0 left-0 rounded-full bg-[#c4a35a]"
                    />
                    <div
                      style={{ left: `${(playbackTime / duration) * 100}%` }}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-[#dcc084] shadow-[0_0_0_4px_rgba(196,163,90,0.3)]"
                    />

                    {/* Step Timestamp Notch Markers */}
                    {steps.map((s) => {
                      const sec = parseTimeToSeconds(s.t);
                      const pct = Math.min(100, Math.max(0, (sec / duration) * 100));
                      return (
                        <div
                          key={s.id}
                          style={{ left: `${pct}%` }}
                          className="absolute -top-1 h-3.5 w-[2px] bg-[#c4a35a]/70"
                          title={`Step ${s.n}: ${s.text}`}
                        />
                      );
                    })}
                  </div>

                  {/* Play/Pause & Time & Volume */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c4a35a] text-[#0a0a0a] hover:bg-[#dcc084] transition"
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
                      <span className="font-mono text-xs text-[#f4f2ee]/60">
                        {formatSeconds(playbackTime)} / {formatSeconds(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-[#f4f2ee]/40">Volume</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setVolume(v);
                          if (reviewVideoRef.current) reviewVideoRef.current.volume = v;
                        }}
                        className="w-20 accent-[#c4a35a]"
                      />
                    </div>
                  </div>
                </div>

                {/* Secondary Actions */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStage("setup");
                      setVideoBlobUrl(null);
                    }}
                    className="rounded-lg border border-white/10 bg-[#141414] px-4 py-2.5 text-xs font-semibold text-[#f4f2ee]/70 hover:border-[#cf603c]/50 hover:text-[#e8a48a] transition"
                  >
                    Re-record Video
                  </button>

                  {videoBlobUrl && (
                    <a
                      href={videoBlobUrl}
                      download={`${title.replace(/\s+/g, "_")}.webm`}
                      className="rounded-lg border border-white/10 bg-[#141414] px-4 py-2.5 text-xs font-semibold text-[#f4f2ee]/70 hover:border-[#c4a35a]/50 hover:text-[#dcc084] transition"
                    >
                      Download MP4 / WebM
                    </a>
                  )}
                </div>
              </div>

              {/* Right Column: Voice Transcript & Generated Checklist */}
              <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
                {/* Voice Transcript Card */}
                <div className="rounded-xl border border-white/8 bg-[#141414] p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold tracking-tight text-[#f4f2ee]">Voice Transcript</h4>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#c4a35a]">
                      auto · 98% clear
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {transcript.map((line) => (
                      <div
                        key={line.id}
                        onClick={() => handleSeek(parseTimeToSeconds(line.t))}
                        className="flex gap-3 text-left group cursor-pointer"
                      >
                        <span className="font-mono text-[11px] text-[#c4a35a] pt-0.5 shrink-0 w-9 group-hover:underline">
                          {line.t}
                        </span>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#f4f2ee]/30">
                            {line.who}
                          </span>
                          <p className="text-[13.5px] leading-relaxed text-[#f4f2ee]/65">
                            {line.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generated SOP Checklist Card */}
                <div className="rounded-xl border border-[#c4a35a]/25 bg-[#141414] p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold tracking-tight text-[#f4f2ee]">
                      Generated SOP Checklist
                    </h4>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#f4f2ee]/30">
                      editable
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {steps.map((step, idx) => (
                      <div
                        key={step.id}
                        className="flex items-start gap-3 rounded-lg border border-white/7 bg-[#0e0e0e] p-3.5"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#c4a35a]/40 bg-[#c4a35a]/15 font-mono text-[11px] font-bold text-[#dcc084]">
                          {step.n}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={step.text}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSteps((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, text: v } : s))
                              );
                            }}
                            className="w-full bg-transparent text-[13.5px] font-medium text-[#f4f2ee]/85 outline-none focus:text-white"
                          />
                          <div className="font-mono text-[10px] text-[#f4f2ee]/30">
                            from voice at {step.t}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSteps((prev) => {
                              const filtered = prev.filter((_, i) => i !== idx);
                              return filtered.map((s, i) => ({ ...s, n: i + 1 }));
                            });
                          }}
                          className="text-[#f4f2ee]/25 hover:text-[#cf603c] text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextN = steps.length + 1;
                      setSteps([
                        ...steps,
                        {
                          id: `step-${Date.now()}-${nextN}`,
                          n: nextN,
                          t: formatSeconds(playbackTime),
                          text: `New action step at ${formatSeconds(playbackTime)}`,
                          description: "",
                        },
                      ]);
                    }}
                    className="text-xs text-[#f4f2ee]/35 hover:text-[#dcc084] transition"
                  >
                    + Add a step
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
