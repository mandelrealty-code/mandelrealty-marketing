import { useState, useRef, useEffect } from "react";
import type { SopStep, SopCategory, SopTargetRole } from "../../../shared/pm/sopTypes";

interface CaptureStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSteps: (
    steps: SopStep[],
    meta: { title: string; category: SopCategory; target_role: SopTargetRole; summary: string }
  ) => void;
  onOpenScreenshotRedactor?: () => void;
}

type CaptureMode = "click" | "spacebar";

interface CapturedFrame {
  id: string;
  stepNum: number;
  dataUrl: string;
  title: string;
  instruction: string;
  clickX?: number; // percentage 0 to 1
  clickY?: number; // percentage 0 to 1
  hasSpotlight: boolean;
  hasRedaction: boolean;
  redactionBox?: { x: number; y: number; w: number; h: number };
}

export function CaptureStudioModal({
  isOpen,
  onClose,
  onInsertSteps,
  onOpenScreenshotRedactor,
}: CaptureStudioModalProps) {
  // Navigation & Workflow state: 'choose' | 'recording' | 'review'
  const [stage, setStage] = useState<"choose" | "recording" | "review">("choose");
  
  // Capture settings
  const [captureMode, setCaptureMode] = useState<CaptureMode>("click");
  const [sopTitle, setSopTitle] = useState("Turnover & Gap Approval Guide");
  const [targetRole, setTargetRole] = useState<SopTargetRole>("va");
  const [category, setCategory] = useState<SopCategory>("turnover");
  
  // Active stream and recording
  const [isLiveStream, setIsLiveStream] = useState(false);
  const [recordedFrames, setRecordedFrames] = useState<CapturedFrame[]>([]);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Hidden video & canvas for taking snapshots from getDisplayMedia
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Clean up media streams on unmount or close
  const stopStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsLiveStream(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setStage("choose");
      setRecordedFrames([]);
      setRecordingSeconds(0);
    }
  }, [isOpen]);

  // Start actual Browser Screen / Tab capture
  const handleStartRealCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false,
      });
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // If user clicks native "Stop sharing", wrap up recording
      stream.getVideoTracks()[0].onended = () => {
        handleFinishRecording();
      };

      setIsLiveStream(true);
      setRecordedFrames([]);
      setStage("recording");
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      // If user cancels or permission denied, fallback to demo interactive session
      handleStartSimulatedCapture();
    }
  };

  // Simulated capture session (for quick testing or when screen permission is not granted)
  const handleStartSimulatedCapture = () => {
    setIsLiveStream(false);
    setRecordedFrames([]);
    setStage("recording");
    setRecordingSeconds(0);
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Helper to grab frame from video element or generate clean visual placeholder
  const grabCurrentFrame = (clickX?: number, clickY?: number): string => {
    if (videoRef.current && canvasRef.current && isLiveStream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png");
      }
    }

    // High quality canvas fallback snapshot for PMS
    const fallbackCanvas = document.createElement("canvas");
    fallbackCanvas.width = 1280;
    fallbackCanvas.height = 720;
    const ctx = fallbackCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#121214";
      ctx.fillRect(0, 0, 1280, 720);

      // Header bar
      ctx.fillStyle = "#1a1a1d";
      ctx.fillRect(0, 0, 1280, 50);
      ctx.fillStyle = "#6f6a65";
      ctx.font = "14px monospace";
      ctx.fillText("app.guesty.com/mandel-realty/multi-calendar", 30, 32);

      // Calendar grid lines
      ctx.fillStyle = "#222226";
      ctx.fillRect(40, 90, 1200, 580);

      ctx.fillStyle = "#c4a35a";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(`PMS Workflow Step #${recordedFrames.length + 1}`, 60, 140);

      ctx.fillStyle = "#9a9590";
      ctx.font = "15px sans-serif";
      ctx.fillText(
        `Action captured at ${new Date().toLocaleTimeString()} · Target: ${
          clickX !== undefined ? `${Math.round(clickX * 100)}%, ${Math.round(clickY! * 100)}%` : "Manual checkpoint"
        }`,
        60,
        175
      );

      return fallbackCanvas.toDataURL("image/png");
    }
    return "";
  };

  // Triggered when user clicks inside the viewfinder
  const handleViewfinderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (stage !== "recording") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const snap = grabCurrentFrame(clickX, clickY);
    const nextNum = recordedFrames.length + 1;

    const newFrame: CapturedFrame = {
      id: `frame-${Date.now()}-${nextNum}`,
      stepNum: nextNum,
      dataUrl: snap,
      title: `Step ${nextNum}: Click on highlighted target`,
      instruction: `Navigate to this section and verify the fields before proceeding.`,
      clickX,
      clickY,
      hasSpotlight: true,
      hasRedaction: false,
    };

    setRecordedFrames((prev) => [...prev, newFrame]);
  };

  // Keyboard shortcut for manual snap (Spacebar)
  useEffect(() => {
    if (stage !== "recording") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        const snap = grabCurrentFrame();
        const nextNum = recordedFrames.length + 1;
        setRecordedFrames((prev) => [
          ...prev,
          {
            id: `frame-${Date.now()}-${nextNum}`,
            stepNum: nextNum,
            dataUrl: snap,
            title: `Step ${nextNum}: Verify workflow screen`,
            instruction: `Review screen contents and verify state.`,
            hasSpotlight: false,
            hasRedaction: false,
          },
        ]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stage, recordedFrames, isLiveStream]);

  // Finish capture and transition to Step Review
  const handleFinishRecording = () => {
    stopStream();
    if (recordedFrames.length === 0) {
      // If nothing snapped yet, snap one frame so review is not blank
      const snap = grabCurrentFrame(0.5, 0.5);
      setRecordedFrames([
        {
          id: `frame-default-1`,
          stepNum: 1,
          dataUrl: snap,
          title: "Step 1: Open dashboard view",
          instruction: "Locate the primary navigation item and click to proceed.",
          clickX: 0.5,
          clickY: 0.5,
          hasSpotlight: true,
          hasRedaction: false,
        },
      ]);
    }
    setActiveFrameIdx(0);
    setStage("review");
  };

  // Complete and export to SopsPanel SOP Editor
  const handleSaveAndExport = () => {
    const formattedSteps: SopStep[] = recordedFrames.map((f, idx) => ({
      id: `sop-step-${Date.now()}-${idx + 1}`,
      step_number: idx + 1,
      title: f.title || `Step ${idx + 1}`,
      description: f.instruction || "Follow the highlighted visual guidance.",
      media_type: "image",
      image_url: f.dataUrl,
      pins:
        f.hasSpotlight && f.clickX !== undefined && f.clickY !== undefined
          ? [
              {
                id: `pin-${idx}`,
                number: idx + 1,
                x: f.clickX,
                y: f.clickY,
                label: f.title,
              },
            ]
          : undefined,
      boxes: f.hasRedaction
        ? [
            {
              id: `redact-${idx}`,
              type: "blur",
              x: 0.55,
              y: 0.15,
              w: 0.3,
              h: 0.12,
              label: "Redacted PII / Code",
            },
          ]
        : undefined,
    }));

    onInsertSteps(formattedSteps, {
      title: sopTitle || "Screen Captured SOP Playbook",
      category,
      target_role: targetRole,
      summary: `Auto-generated ${recordedFrames.length}-step guide captured via Capture Studio.`,
    });

    onClose();
  };

  if (!isOpen) return null;

  const currentFrame = recordedFrames[activeFrameIdx] || recordedFrames[0];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-fadeIn">
      {/* Hidden processing elements */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex h-[92vh] w-full max-w-[1340px] flex-col rounded-xl border border-white/12 bg-[#0e0e0e] shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#141414] border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#c4a35a]/15 border border-[#c4a35a]/30 text-[#c4a35a] font-bold text-sm">
              ◎
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#f5f5f5]">SOP Capture Studio</span>
                <span className="rounded bg-[#1f1e1a] px-2 py-0.5 text-[10.5px] font-mono text-[#c4a35a] border border-[#c4a35a]/30">
                  Scribe-Style Auto-Guide
                </span>
              </div>
              <p className="text-xs text-[#9a9590]">
                Choose how you want to build this guide: record live actions or upload screenshots.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stage === "recording" && (
              <button
                type="button"
                onClick={handleFinishRecording}
                className="flex items-center gap-2 rounded-md bg-[#c4a35a] px-4 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-md transition"
              >
                <span>Finish & Review ({recordedFrames.length} Steps)</span>
                <span>→</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#1a1a1a] text-[#9a9590] hover:text-[#f5f5f5] hover:bg-[#222]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* STAGE 1: CHOOSE METHOD (SCREEN RECORD VS SCREENSHOTS)   */}
        {/* ======================================================== */}
        {stage === "choose" && (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center">
            <div className="w-full max-w-3xl space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-[#f5f5f5]">How would you like to create this SOP?</h2>
                <p className="text-xs sm:text-sm text-[#9a9590] max-w-xl mx-auto">
                  Pick the fastest method for your workflow. No complicated setup required.
                </p>
              </div>

              {/* Two Simple Choices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Option 1: Live Screen Capture (Scribe Style) */}
                <div
                  onClick={handleStartRealCapture}
                  className="group relative flex flex-col justify-between rounded-xl border border-[#c4a35a]/40 bg-[#161513] p-6 hover:border-[#c4a35a] hover:bg-[#1a1814] cursor-pointer transition shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#c4a35a] text-[#0a0a0a] font-bold text-lg shadow-md">
                        ●
                      </div>
                      <span className="rounded-full bg-[#c4a35a]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#c4a35a] border border-[#c4a35a]/35">
                        Automated (Recommended)
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#f5f5f5] group-hover:text-[#c4a35a] transition">
                        Live Screen Recording
                      </h3>
                      <p className="text-xs text-[#9a9590] mt-1.5 leading-relaxed">
                        Share your Guesty, Stripe, or Airbnb tab. Every time you click or press Spacebar, it snaps a full-res screenshot and automatically places a gold click callout.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/8 text-xs font-bold text-[#c4a35a]">
                    <span>Start Recording Tab / Window</span>
                    <span className="text-base transition group-hover:translate-x-1">→</span>
                  </div>
                </div>

                {/* Option 2: Upload / Paste Screenshots Instead */}
                <div
                  onClick={() => {
                    onClose();
                    if (onOpenScreenshotRedactor) {
                      onOpenScreenshotRedactor();
                    }
                  }}
                  className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-[#141414] p-6 hover:border-white/20 hover:bg-[#181818] cursor-pointer transition"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#222222] text-[#f5f5f5] font-bold text-lg border border-white/10">
                        🖼
                      </div>
                      <span className="rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-semibold text-[#9a9590] border border-white/10">
                        Manual Mode
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#f5f5f5] group-hover:text-white transition">
                        Use Existing Screenshots
                      </h3>
                      <p className="text-xs text-[#9a9590] mt-1.5 leading-relaxed">
                        Already have screenshots? Paste them directly from your clipboard (⌘V) or upload images to manually draw gold spotlights and blur private codes.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/8 text-xs font-semibold text-[#9a9590] group-hover:text-[#f5f5f5]">
                    <span>Open Screenshot Redactor</span>
                    <span className="text-base transition group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </div>

              {/* Simplified Capture Settings */}
              <div className="rounded-lg border border-white/8 bg-[#111111] p-5 space-y-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6f6a65]">
                  Recording Options
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setCaptureMode("click")}
                    className={`flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer transition ${
                      captureMode === "click"
                        ? "border-[#c4a35a]/50 bg-[#c4a35a]/10 text-[#f5f5f5]"
                        : "border-white/8 bg-[#161616] text-[#9a9590]"
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c4a35a] text-[#0a0a0a] font-bold text-xs">
                      ①
                    </div>
                    <div>
                      <div className="text-xs font-bold">Click-to-Snap (Auto Spotlight)</div>
                      <div className="text-[11px] text-[#6f6a65]">Snaps a frame wherever you click</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setCaptureMode("spacebar")}
                    className={`flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer transition ${
                      captureMode === "spacebar"
                        ? "border-[#c4a35a]/50 bg-[#c4a35a]/10 text-[#f5f5f5]"
                        : "border-white/8 bg-[#161616] text-[#9a9590]"
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-[#f5f5f5] font-mono text-xs">
                      ␣
                    </div>
                    <div>
                      <div className="text-xs font-bold">Spacebar Trigger</div>
                      <div className="text-[11px] text-[#6f6a65]">Press Space while navigating your PMS</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 2: LIVE VIEWFINDER & ACTION CAPTURE HUD            */}
        {/* ======================================================== */}
        {stage === "recording" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#08080a]">
            {/* Recording status bar */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-[#111111] border-b border-white/8">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#cf603c] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#cf603c]"></span>
                </span>
                <span className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider">
                  Recording Active
                </span>
                <span className="text-xs font-mono text-[#6f6a65]">
                  {Math.floor(recordingSeconds / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(recordingSeconds % 60).toString().padStart(2, "0")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9a9590]">
                  Click anywhere in the screen or tap <kbd className="rounded bg-[#222] px-1.5 py-0.5 font-mono text-[#c4a35a]">Space</kbd> to record a step
                </span>
              </div>
            </div>

            {/* Viewfinder Main Viewport */}
            <div className="flex-1 flex min-h-0">
              {/* Left Viewfinder */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-0 overflow-hidden">
                <div
                  onClick={handleViewfinderClick}
                  className="relative w-full max-w-4xl aspect-video rounded-lg border border-white/14 bg-[#141416] overflow-hidden cursor-crosshair shadow-2xl flex flex-col"
                >
                  {/* Mock Browser Bar */}
                  <div className="flex items-center justify-between bg-[#1b1b1e] px-4 py-2 border-b border-white/8">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3e]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3e]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3e]" />
                      <span className="ml-3 font-mono text-[11px] text-[#9a9590]">
                        {isLiveStream ? "Live Screen Share Feed" : "Simulated PMS Window · Guesty / Airbnb"}
                      </span>
                    </div>
                    <span className="rounded bg-[#2a2a30] px-2 py-0.5 text-[10.5px] text-[#c4a35a] font-bold">
                      Click to Capture Step
                    </span>
                  </div>

                  {/* Viewport Content Area */}
                  <div className="flex-1 relative flex flex-col justify-center items-center p-8 text-center select-none bg-gradient-to-b from-[#141417] to-[#0d0d0f]">
                    <div className="space-y-3 pointer-events-none">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#c4a35a]/15 text-[#c4a35a] text-xl font-bold">
                        ＋
                      </div>
                      <div className="text-base font-bold text-[#f5f5f5]">
                        Perform Your Action Here
                      </div>
                      <p className="text-xs text-[#9a9590] max-w-sm">
                        Click on buttons, menus, or fields. A screenshot and a numbered gold callout will automatically be created.
                      </p>
                    </div>

                    {/* Visual pins overlay of captured steps */}
                    {recordedFrames.map((f) => {
                      if (f.clickX === undefined || f.clickY === undefined) return null;
                      return (
                        <div
                          key={f.id}
                          style={{ left: `${f.clickX * 100}%`, top: `${f.clickY * 100}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-bounce"
                        >
                          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#c4a35a] text-[#0a0a0a] text-xs font-bold shadow-lg">
                            {f.stepNum}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Live Step Feed */}
              <div className="w-80 border-l border-white/8 bg-[#111111] flex flex-col shrink-0">
                <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6f6a65]">
                    Recorded Steps
                  </span>
                  <span className="font-mono text-xs text-[#c4a35a] font-bold">
                    {recordedFrames.length} captured
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {recordedFrames.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center text-center p-4 text-[#6f6a65] text-xs">
                      No steps captured yet. Click on the screen to snap your first step.
                    </div>
                  ) : (
                    recordedFrames.map((f, idx) => (
                      <div
                        key={f.id}
                        className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-[#161616] p-2.5"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c4a35a] text-[11px] font-bold text-[#0a0a0a]">
                          {f.stepNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#f5f5f5] truncate">
                            {f.title}
                          </div>
                          <div className="text-[10.5px] text-[#6f6a65] mt-0.5">
                            {f.clickX !== undefined
                              ? `Target placed at (${Math.round(f.clickX * 100)}%, ${Math.round(f.clickY! * 100)}%)`
                              : "Manual snapshot"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRecordedFrames((prev) => {
                              const updated = prev.filter((_, i) => i !== idx);
                              return updated.map((item, i) => ({ ...item, stepNum: i + 1 }));
                            });
                          }}
                          className="text-[#6f6a65] hover:text-[#cf603c] text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 3: STEP REVIEW & SEQUENCE STUDIO (SPLIT VIEW)      */}
        {/* ======================================================== */}
        {stage === "review" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0e]">
            {/* SOP Details Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-[#141414] border-b border-white/8">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#c4a35a]">
                  Guide Title:
                </span>
                <input
                  type="text"
                  value={sopTitle}
                  onChange={(e) => setSopTitle(e.target.value)}
                  placeholder="e.g. How to Verify Early Check-in Gap in Guesty"
                  className="flex-1 rounded border border-white/10 bg-[#0a0a0a] px-3 py-1.5 text-xs font-bold text-[#f5f5f5] outline-none focus:border-[#c4a35a]/50"
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SopCategory)}
                  className="rounded border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#f5f5f5] outline-none"
                >
                  <option value="guest_ops">Guest Ops</option>
                  <option value="turnover">Turnover</option>
                  <option value="outreach">Outreach</option>
                  <option value="team_comms">Team Comms</option>
                  <option value="software">Software / Tech</option>
                  <option value="maintenance">Maintenance</option>
                </select>

                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as SopTargetRole)}
                  className="rounded border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#f5f5f5] outline-none"
                >
                  <option value="va">Target Role: VA Team</option>
                  <option value="cleaner">Target Role: Cleaner</option>
                  <option value="manager">Target Role: Manager</option>
                  <option value="all">Target Role: Everyone</option>
                </select>

                <button
                  type="button"
                  onClick={handleSaveAndExport}
                  className="rounded-md bg-[#c4a35a] px-4 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-md transition"
                >
                  Save SOP to Playbook ✓
                </button>
              </div>
            </div>

            {/* Split Review Studio */}
            <div className="flex-1 flex min-h-0">
              {/* Left Preview Pane */}
              <div className="flex-1 flex flex-col p-6 min-h-0 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#f5f5f5]">
                      Step {activeFrameIdx + 1} Visual Preview
                    </span>
                    <span className="text-xs text-[#6f6a65]">
                      ({activeFrameIdx + 1} of {recordedFrames.length})
                    </span>
                  </div>

                  {/* Toggle Spotlight & Blur */}
                  {currentFrame && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecordedFrames((prev) =>
                            prev.map((f, i) =>
                              i === activeFrameIdx ? { ...f, hasSpotlight: !f.hasSpotlight } : f
                            )
                          );
                        }}
                        className={`rounded px-2.5 py-1 text-xs font-semibold border transition ${
                          currentFrame.hasSpotlight
                            ? "border-[#c4a35a]/50 bg-[#c4a35a]/15 text-[#c4a35a]"
                            : "border-white/10 bg-[#1a1a1a] text-[#9a9590]"
                        }`}
                      >
                        {currentFrame.hasSpotlight ? "✓ Gold Spotlight Active" : "Add Gold Spotlight"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRecordedFrames((prev) =>
                            prev.map((f, i) =>
                              i === activeFrameIdx ? { ...f, hasRedaction: !f.hasRedaction } : f
                            )
                          );
                        }}
                        className={`rounded px-2.5 py-1 text-xs font-semibold border transition ${
                          currentFrame.hasRedaction
                            ? "border-[#c0603c]/50 bg-[#c0603c]/15 text-[#cf7f7b]"
                            : "border-white/10 bg-[#1a1a1a] text-[#9a9590]"
                        }`}
                      >
                        {currentFrame.hasRedaction ? "✓ Blur Mask Applied" : "+ Blur Private Codes"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Screenshot with overlays */}
                {currentFrame && (
                  <div className="relative w-full flex-1 min-h-[360px] rounded-lg border border-white/10 bg-[#08080a] overflow-hidden flex items-center justify-center">
                    <img
                      src={currentFrame.dataUrl}
                      alt={`Step ${currentFrame.stepNum}`}
                      className="w-full h-full object-contain"
                    />

                    {/* Gold Spotlight Callout */}
                    {currentFrame.hasSpotlight &&
                      currentFrame.clickX !== undefined &&
                      currentFrame.clickY !== undefined && (
                        <div
                          style={{
                            left: `${currentFrame.clickX * 100}%`,
                            top: `${currentFrame.clickY * 100}%`,
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        >
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#c4a35a] text-[#0a0a0a] text-sm font-bold shadow-2xl ring-4 ring-[#c4a35a]/40">
                            {currentFrame.stepNum}
                          </div>
                        </div>
                      )}

                    {/* Simulated Blur Redaction Box */}
                    {currentFrame.hasRedaction && (
                      <div className="absolute top-[15%] right-[20%] w-48 h-12 rounded border border-dashed border-white/40 bg-white/10 backdrop-blur-md flex items-center justify-center text-[11px] font-mono text-white/80 pointer-events-none">
                        [Redacted Door Code / PII]
                      </div>
                    )}
                  </div>
                )}
              </div>

                {/* Right Sequence Step List & Editor */}
              <div className="w-96 border-l border-white/8 bg-[#111111] flex flex-col shrink-0">
                <div className="px-4 py-3 border-b border-white/8">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6f6a65]">
                    Step Sequence & Instructions
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {recordedFrames.map((frame, idx) => {
                    const isSelected = idx === activeFrameIdx;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => setActiveFrameIdx(idx)}
                        className={`rounded-lg border p-3.5 cursor-pointer transition ${
                          isSelected
                            ? "border-[#c4a35a]/50 bg-[#1c1914]"
                            : "border-white/8 bg-[#161616] hover:border-white/16"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-bold ${
                                isSelected ? "bg-[#c4a35a] text-[#0a0a0a]" : "bg-[#2a2a2a] text-[#9a9590]"
                              }`}
                            >
                              {frame.stepNum}
                            </span>
                            <span className="text-xs font-bold text-[#f5f5f5]">Step {frame.stepNum}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {frame.hasSpotlight && (
                              <span className="text-[9.5px] font-mono text-[#c4a35a] bg-[#c4a35a]/10 px-1.5 py-0.5 rounded">
                                Spotlight
                              </span>
                            )}
                            {recordedFrames.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRecordedFrames((prev) => {
                                    const next = prev.filter((_, i) => i !== idx);
                                    return next.map((item, i) => ({ ...item, stepNum: i + 1 }));
                                  });
                                  if (activeFrameIdx >= recordedFrames.length - 1) {
                                    setActiveFrameIdx(Math.max(0, recordedFrames.length - 2));
                                  }
                                }}
                                className="text-[#6f6a65] hover:text-[#cf603c] text-xs px-1"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="space-y-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={frame.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRecordedFrames((prev) =>
                                  prev.map((f, i) => (i === idx ? { ...f, title: val } : f))
                                );
                              }}
                              placeholder="Step title"
                              className="w-full rounded border border-white/10 bg-[#0a0a0a] px-2.5 py-1.5 text-xs text-[#f5f5f5] font-semibold outline-none focus:border-[#c4a35a]/50"
                            />
                            <textarea
                              rows={2}
                              value={frame.instruction}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRecordedFrames((prev) =>
                                  prev.map((f, i) => (i === idx ? { ...f, instruction: val } : f))
                                );
                              }}
                              placeholder="Instructions for VA..."
                              className="w-full rounded border border-white/10 bg-[#0a0a0a] p-2 text-xs text-[#9a9590] outline-none focus:border-[#c4a35a]/50 resize-y"
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-[#9a9590] truncate">{frame.title}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
