import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { SopItem, SopStep, SopCategory, SopTargetRole } from "../../../shared/pm/sopTypes";
import { storeSopVideoBlob, getSopVideoBlob } from "../../lib/sopVideoStorage";
import { pmPost } from "../../pages/clients/api";
import { ImageRedactorModal } from "./ImageRedactorModal";

export function parseTimeToSeconds(t: string | undefined): number {
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

export function formatSeconds(sec: number): string {
  const valid = Math.max(0, isNaN(sec) ? 0 : sec);
  const m = Math.floor(valid / 60);
  const s = Math.floor(valid % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function isDocumentPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

function copyStyleSheetsToDocument(targetDoc: Document) {
  [...document.styleSheets].forEach((styleSheet) => {
    try {
      if (styleSheet.cssRules) {
        const style = targetDoc.createElement("style");
        [...styleSheet.cssRules].forEach((rule) => {
          style.appendChild(targetDoc.createTextNode(rule.cssText));
        });
        targetDoc.head.appendChild(style);
      }
    } catch {
      if (styleSheet.href) {
        const link = targetDoc.createElement("link");
        link.rel = "stylesheet";
        link.href = styleSheet.href;
        targetDoc.head.appendChild(link);
      }
    }
  });
}

interface VideoSopStudioModalProps {
  isOpen: boolean;
  initialSop?: SopItem | null;
  onClose: () => void;
  onDeleteSop?: (idOrSlug: string) => void;
  onSaveSop: (
    steps: SopStep[],
    meta: {
      id?: string;
      slug?: string;
      title: string;
      category: SopCategory;
      target_role: SopTargetRole;
      summary: string;
      video_url?: string;
      transcript?: TranscriptLine[];
      author?: string;
      created_at?: string;
    }
  ) => void;
}

export interface TranscriptLine {
  id: string;
  t: string;
  seconds: number;
  who: string;
  text: string;
}

interface DocumentPictureInPicture {
  window: Window | null;
  requestWindow(options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
}

// Modal Stages: 'setup' | 'recording' | 'review' | 'trimming' | 'saved'
export function VideoSopStudioModal({
  isOpen,
  initialSop,
  onClose,
  onDeleteSop,
  onSaveSop,
}: VideoSopStudioModalProps) {
  const [stage, setStage] = useState<"setup" | "recording" | "review" | "trimming" | "saved">("setup");
  const [recordMode, setRecordMode] = useState<"snapshots" | "video">("snapshots");
  const [isSaving, setIsSaving] = useState(false);

  // SOP Metadata
  const [title, setTitle] = useState("");
  const [targetRole, setTargetRole] = useState<SopTargetRole>("va");
  const [category, setCategory] = useState<SopCategory>("turnover");

  // Step List (for Scribe snapshots & Video chapters)
  const [steps, setSteps] = useState<SopStep[]>([]);
  const [activeRedactorStepIdx, setActiveRedactorStepIdx] = useState<number | null>(null);
  const [snapFlash, setSnapFlash] = useState<string | null>(null);

  // Recording State & Media
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [micLevel, setMicLevel] = useState<number[]>([14, 18, 22, 10, 20, 16]);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [latestSpokenText, setLatestSpokenText] = useState("");

  // Transcript lines (for full video mode)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  // Video playback controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(102);
  const [volume, setVolume] = useState(1.0);

  // Video Trimmer State
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(102);
  const [isDraggingTrimStart, setIsDraggingTrimStart] = useState(false);
  const [isDraggingTrimEnd, setIsDraggingTrimEnd] = useState(false);
  const [trimAppliedToast, setTrimAppliedToast] = useState(false);

  // Hardware stream refs
  const liveVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const trimVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordingSecondsRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const [pipMountNode, setPipMountNode] = useState<HTMLElement | null>(null);
  const [pipOpenFailed, setPipOpenFailed] = useState(false);

  // Sync with initialSop when modal is opened for editing
  useEffect(() => {
    if (isOpen) {
      if (initialSop) {
        setTitle(initialSop.title || "SOP Guide");
        setTargetRole(initialSop.target_role || "va");
        setCategory(initialSop.category || "turnover");
        setSteps(initialSop.steps || []);

        const hasVideo =
          Boolean(initialSop.video_url) ||
          initialSop.steps?.some((s) => s.media_type === "video_embed" || Boolean(s.video_url));

        setRecordMode(hasVideo ? "video" : "snapshots");

        if (initialSop.slug) {
          getSopVideoBlob(initialSop.slug).then((blob) => {
            if (blob) {
              recordedBlobRef.current = blob;
              setVideoBlobUrl(URL.createObjectURL(blob));
            } else if (initialSop.video_url) {
              setVideoBlobUrl(initialSop.video_url);
            }
          });
        } else if (initialSop.video_url) {
          setVideoBlobUrl(initialSop.video_url);
        }

        if (initialSop.transcript && initialSop.transcript.length > 0) {
          setTranscript(
            initialSop.transcript.map((line) => ({
              id: line.id,
              t: line.t,
              seconds: line.seconds != null ? line.seconds : parseTimeToSeconds(line.t),
              who: line.who || "Speaker",
              text: line.text,
            }))
          );
        } else if (initialSop.steps && initialSop.steps.length > 0) {
          const loaded: TranscriptLine[] = initialSop.steps.map((st, idx) => {
            const stepSec =
              st.seconds != null
                ? st.seconds
                : st.timestamp
                ? parseTimeToSeconds(st.timestamp)
                : idx * 6;
            return {
              id: st.id || `tr-${Date.now()}-${idx}`,
              t: st.timestamp || formatSeconds(stepSec),
              seconds: stepSec,
              who: `Step ${st.step_number || idx + 1}`,
              text: st.description || st.title || "",
            };
          });
          setTranscript(loaded);
        }

        const est = (initialSop.estimated_minutes || 2) * 60;
        setDuration(est);
        setTrimStart(0);
        setTrimEnd(est);
        setStage("review");
      } else {
        setStage("setup");
        setRecordMode("snapshots");
        setSteps([]);
        setTranscript([]);
        setTitle("");
        setVideoBlobUrl(null);
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        setLatestSpokenText("");
      }
    }
  }, [isOpen, initialSop]);

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
  const closeRecordingPipWindow = () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setPipMountNode(null);
    setPipOpenFailed(false);
  };

  const openRecordingPipWindow = async (): Promise<boolean> => {
    const dpp = (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
    if (!dpp?.requestWindow) return false;

    if (dpp.window && !dpp.window.closed) {
      pipWindowRef.current = dpp.window;
      let mount = dpp.window.document.getElementById("sop-recording-hud-mount");
      if (!mount) {
        mount = dpp.window.document.createElement("div");
        mount.id = "sop-recording-hud-mount";
        dpp.window.document.body.appendChild(mount);
      }
      setPipMountNode(mount);
      setPipOpenFailed(false);
      return true;
    }

    try {
      const pipWin = await dpp.requestWindow({
        width: 580,
        height: 96,
        disallowReturnToOpener: false,
        preferInitialWindowPlacement: true,
      });
      copyStyleSheetsToDocument(pipWin.document);
      pipWin.document.body.style.margin = "0";
      pipWin.document.body.style.padding = "10px";
      pipWin.document.body.style.background = "#121214";
      pipWin.document.body.style.overflow = "hidden";

      const mount = pipWin.document.createElement("div");
      mount.id = "sop-recording-hud-mount";
      pipWin.document.body.appendChild(mount);

      pipWindowRef.current = pipWin;
      setPipMountNode(mount);
      setPipOpenFailed(false);

      pipWin.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipMountNode(null);
      });

      return true;
    } catch (err) {
      console.warn("Could not open floating recording controls:", err);
      setPipOpenFailed(true);
      return false;
    }
  };

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
    closeRecordingPipWindow();
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupStreams();
      setStage("setup");
      setRecordingSeconds(0);
      setIsPlaying(false);
      setTrimStart(0);
      setTrimEnd(102);
      setEditingTranscriptId(null);
      setActiveRedactorStepIdx(null);
    }
  }, [isOpen]);

  // Sync volume
  useEffect(() => {
    if (reviewVideoRef.current) {
      reviewVideoRef.current.volume = volume;
      reviewVideoRef.current.muted = false;
    }
    if (trimVideoRef.current) {
      trimVideoRef.current.volume = volume;
      trimVideoRef.current.muted = false;
    }
  }, [volume, videoBlobUrl]);

  // Frame capture from the live screen-share stream (ImageCapture API + fallbacks)
  const captureCurrentScreenFrame = async (): Promise<string | null> => {
    const stream = screenStreamRef.current;
    if (!stream) return null;

    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return null;

    const canvasFromSource = (source: CanvasImageSource, w: number, h: number): string | null => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(source, 0, 0, w, h);
        return canvas.toDataURL("image/jpeg", 0.92);
      } catch (err) {
        console.warn("Canvas snapshot failed:", err);
        return null;
      }
    };

    // 1) ImageCapture — works even when hidden <video> has no dimensions yet
    if (typeof ImageCapture !== "undefined") {
      try {
        const capturer = new ImageCapture(track);
        const bitmap = await capturer.grabFrame();
        const dataUrl = canvasFromSource(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
        if (dataUrl) return dataUrl;
      } catch (err) {
        console.warn("ImageCapture grabFrame failed:", err);
      }
    }

    // 2) Hidden preview video element
    const videoEl = liveVideoElementRef.current;
    if (videoEl) {
      if (!videoEl.srcObject) {
        videoEl.srcObject = stream;
      }
      if (videoEl.readyState < 2) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          videoEl.addEventListener("loadeddata", done, { once: true });
          setTimeout(done, 400);
        });
      }
      await videoEl.play().catch(() => {});
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        const dataUrl = canvasFromSource(videoEl, videoEl.videoWidth, videoEl.videoHeight);
        if (dataUrl) return dataUrl;
      }
    }

    // 3) Ephemeral video element bound to the same stream
    try {
      const temp = document.createElement("video");
      temp.srcObject = stream;
      temp.muted = true;
      temp.playsInline = true;
      await temp.play();
      for (let i = 0; i < 30; i++) {
        if (temp.videoWidth > 0) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (temp.videoWidth > 0 && temp.videoHeight > 0) {
        const dataUrl = canvasFromSource(temp, temp.videoWidth, temp.videoHeight);
        temp.srcObject = null;
        if (dataUrl) return dataUrl;
      }
      temp.srcObject = null;
    } catch (err) {
      console.warn("Temp video snapshot failed:", err);
    }

    return null;
  };

  const attachStreamToLivePreview = (stream: MediaStream) => {
    const videoEl = liveVideoElementRef.current;
    if (!videoEl) return;
    videoEl.srcObject = stream;
    const play = () => videoEl.play().catch(() => {});
    if (videoEl.readyState >= 1) play();
    else videoEl.addEventListener("loadedmetadata", play, { once: true });
  };

  useEffect(() => {
    if (stage !== "recording" || !screenStreamRef.current) return;
    attachStreamToLivePreview(screenStreamRef.current);
  }, [stage]);

  // Capture Step Snapshot (triggered by HUD button or hotkey)
  const handleCaptureSnapshotStep = async () => {
    const frameDataUrl = await captureCurrentScreenFrame();
    const currentSec = Math.max(0, recordingSecondsRef.current || recordingSeconds);
    const timeStr = formatSeconds(currentSec);

    const stepNum = steps.length + 1;
    const spoken = latestSpokenText.trim();
    const stepTitle = spoken
      ? spoken.length > 55
        ? `${spoken.slice(0, 52)}...`
        : spoken
      : `Step ${stepNum}: Action`;
    const stepDesc = spoken || "Click the highlighted area or follow the instruction below.";

    if (!frameDataUrl) {
      setSnapFlash("⚠️ Screenshot failed — wait 1s, then try again");
      setTimeout(() => setSnapFlash(null), 2800);
      return;
    }

    const newStep: SopStep = {
      id: `step-${Date.now()}-${stepNum}`,
      step_number: stepNum,
      title: stepTitle,
      description: stepDesc,
      timestamp: timeStr,
      seconds: currentSec,
      media_type: "image",
      image_url: frameDataUrl,
      raw_image_url: frameDataUrl,
      pro_tip: stepNum === 1 ? "Verify all fields on screen before proceeding." : undefined,
    };

    setSteps((prev) => [...prev, newStep]);
    setLatestSpokenText("");

    setSnapFlash(`📸 Step ${stepNum} captured`);
    setTimeout(() => setSnapFlash(null), 2000);
  };

  // Keyboard shortcut during recording (S or Space to snap)
  useEffect(() => {
    if (stage !== "recording") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === " " || e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleCaptureSnapshotStep();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stage, steps.length, latestSpokenText]);

  // Start real recording (Screen + Microphone)
  const handleStartRecording = async (mode: "snapshots" | "video") => {
    setRecordMode(mode);
    setPipOpenFailed(false);

    // Open always-on-top control bar while user gesture is still active
    await openRecordingPipWindow();

    try {
      // 1. Get Screen Stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });
      screenStreamRef.current = screenStream;

      attachStreamToLivePreview(screenStream);

      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          handleFinishRecording();
        };
      }

      // 2. Get Microphone Audio Stream
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = micStream;
      } catch (err) {
        console.warn("Mic permission was denied or not available", err);
      }

      // 3. Audio mixer via AudioContext
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const audioDestination = audioCtx.createMediaStreamDestination();

      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(audioDestination);

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 32;
        micSource.connect(analyser);
        analyserRef.current = analyser;
        setMicActive(true);
      } else {
        setMicActive(false);
      }

      if (screenStream && screenStream.getAudioTracks().length > 0) {
        try {
          const screenAudioSource = audioCtx.createMediaStreamSource(screenStream);
          screenAudioSource.connect(audioDestination);
        } catch (e) {
          console.warn("Could not pipe screen audio", e);
        }
      }

      // 4. In Video mode, start MediaRecorder
      if (mode === "video") {
        const mixedAudioTracks = audioDestination.stream.getAudioTracks();
        const combinedTracks: MediaStreamTrack[] = [
          ...screenStream.getVideoTracks(),
          ...mixedAudioTracks,
        ];
        const combinedStream = new MediaStream(combinedTracks);

        recordedChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";

        const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          recordedBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setVideoBlobUrl(url);
        };

        mediaRecorder.start(1000);
      }

      // 5. Speech Recognition
      initSpeechRecognition(mode);

      // 6. Transition to Recording Stage
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recordingStartTimeRef.current = Date.now();
      setIsPaused(false);
      setSteps([]);
      setTranscript([]);
      setStage("recording");

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch {
      handleStartSimulatedRecording(mode);
    }
  };

  // Fallback demo simulation
  const handleStartSimulatedRecording = (mode: "snapshots" | "video") => {
    setRecordMode(mode);
    setStage("recording");
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    recordingStartTimeRef.current = Date.now();
    setIsPaused(false);
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        recordingSecondsRef.current = next;
        return next;
      });
    }, 1000);
  };

  // Speech Recognition
  const initSpeechRecognition = (mode: "snapshots" | "video") => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        const liveTranscripts: TranscriptLine[] = [];

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const currentTxt = event.results[i][0].transcript.trim();
            setLatestSpokenText(currentTxt);

            if (event.results[i].isFinal && currentTxt.length > 2) {
              const nowElapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
              const currentSec = Math.max(0, recordingSecondsRef.current || nowElapsed);
              const mins = Math.floor(currentSec / 60);
              const secs = (currentSec % 60).toString().padStart(2, "0");
              const timeStr = `${mins}:${secs}`;

              if (mode === "video") {
                liveTranscripts.push({
                  id: `tr-${Date.now()}-${i}`,
                  t: timeStr,
                  seconds: currentSec,
                  who: `Step ${liveTranscripts.length + 1}`,
                  text: currentTxt,
                });
                setTranscript([...liveTranscripts]);
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
    if (isPaused) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
      }
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.pause();
      }
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

    const totalSecs = Math.max(3, recordingSecondsRef.current || recordingSeconds || 17);
    setDuration(totalSecs);
    setTrimStart(0);
    setTrimEnd(totalSecs);
    setPlaybackTime(0);
    setIsPlaying(false);

    // If in snapshot mode and user didn't click capture, provide default step
    if (recordMode === "snapshots" && steps.length === 0) {
      setSteps([
        {
          id: `step-${Date.now()}-1`,
          step_number: 1,
          title: title || "Step 1: First action",
          description: "Explain clearly what the team member needs to do here.",
          media_type: "image",
        },
      ]);
    }

    setStage("review");
  };

  // Video Playback Controls
  const handleTogglePlay = () => {
    const targetVideo = stage === "trimming" ? trimVideoRef.current : reviewVideoRef.current;
    if (!targetVideo) {
      setIsPlaying(!isPlaying);
      return;
    }

    if (isPlaying) {
      targetVideo.pause();
      setIsPlaying(false);
    } else {
      if (playbackTime < trimStart || playbackTime >= trimEnd - 0.2) {
        targetVideo.currentTime = trimStart;
        setPlaybackTime(trimStart);
      }
      targetVideo.volume = volume;
      targetVideo.muted = false;
      targetVideo.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(true);
      });
    }
  };

  const handleSeek = (time: number | undefined) => {
    const target = typeof time === "number" && !isNaN(time) ? time : 0;
    const clamped = Math.max(0, Math.min(duration || 9999, target));
    setPlaybackTime(clamped);
    if (reviewVideoRef.current) {
      reviewVideoRef.current.currentTime = clamped;
    }
    if (trimVideoRef.current) {
      trimVideoRef.current.currentTime = clamped;
    }
  };

  // Step editing functions
  const handleUpdateStep = (idx: number, patch: Partial<SopStep>) => {
    setSteps((prev) => {
      const next = [...prev];
      if (next[idx]) {
        next[idx] = { ...next[idx], ...patch };
      }
      return next;
    });
  };

  const handleDeleteStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 })));
  };

  const handleAddBlankStep = () => {
    const stepNum = steps.length + 1;
    setSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}-${stepNum}`,
        step_number: stepNum,
        title: `Step ${stepNum}: New action`,
        description: "Describe the action required.",
        media_type: "image",
      },
    ]);
  };

  // Transcript Editing Handlers (for video mode)
  const handleStartEditLine = (line: TranscriptLine) => {
    setEditingTranscriptId(line.id);
    setEditingText(line.text);
    const targetSec = line.seconds != null ? line.seconds : parseTimeToSeconds(line.t);
    handleSeek(targetSec);
  };

  const handleSaveLine = (id: string) => {
    if (!editingText.trim()) return;
    setTranscript((prev) =>
      prev.map((item) => (item.id === id ? { ...item, text: editingText.trim() } : item))
    );
    setEditingTranscriptId(null);
  };

  const handleDeleteLine = (id: string) => {
    setTranscript((prev) => prev.filter((item) => item.id !== id));
    setEditingTranscriptId(null);
  };

  const handleAddLine = () => {
    const currentSec = Math.round(playbackTime);
    const timeStr = formatSeconds(currentSec);
    const newLine: TranscriptLine = {
      id: `tr-${Date.now()}`,
      t: timeStr,
      seconds: currentSec,
      who: `Step ${transcript.length + 1}`,
      text: "New instruction step at this timestamp...",
    };
    const updated = [...transcript, newLine].sort((a, b) => a.seconds - b.seconds);
    setTranscript(updated);
    setEditingTranscriptId(newLine.id);
    setEditingText(newLine.text);
  };

  const handleTidyWording = () => {
    setTranscript((prev) =>
      prev.map((line) => {
        let txt = line.text.trim();
        if (txt.length > 0) {
          txt = txt.charAt(0).toUpperCase() + txt.slice(1);
          if (!/[.!?]$/.test(txt)) txt += ".";
        }
        return { ...line, text: txt };
      })
    );
  };

  // Trimming Handlers
  const handleApplyTrim = () => {
    if (reviewVideoRef.current) {
      reviewVideoRef.current.currentTime = trimStart;
    }
    setPlaybackTime(trimStart);
    setStage("review");
    setTrimAppliedToast(true);
    setTimeout(() => setTrimAppliedToast(false), 2400);

    setTranscript((prev) => {
      const filtered = prev.filter(
        (item) => item.seconds >= trimStart && item.seconds <= trimEnd
      );
      return filtered.map((item, idx) => {
        const shiftedSec = Math.max(0, Math.min(trimEnd - trimStart, item.seconds - trimStart));
        return {
          ...item,
          who: `Step ${idx + 1}`,
          seconds: shiftedSec,
          t: formatSeconds(shiftedSec),
        };
      });
    });
  };

  const handleDiscardTrim = () => {
    setTrimStart(0);
    setTrimEnd(duration);
    setPlaybackTime(0);
    setStage("review");
  };

  // Save to Playbook
  const handleSaveToPlaybook = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const currentSlug = initialSop?.slug || `sop-${Date.now()}`;
      let finalVideoUrl = videoBlobUrl || undefined;

      // 1. If video was recorded, store & upload
      if (recordMode === "video" && recordedBlobRef.current) {
        await storeSopVideoBlob(currentSlug, recordedBlobRef.current);
        try {
          const b64 = await blobToBase64(recordedBlobRef.current);
          if (b64) {
            const upRes = await pmPost<{ ok: boolean; video_url?: string }>("sops", {
              op: "upload_video",
              slug: currentSlug,
              video_base64: b64,
              mime: recordedBlobRef.current.type || "video/webm",
            });
            if (upRes.video_url) {
              finalVideoUrl = upRes.video_url;
            }
          }
        } catch (uploadErr) {
          console.warn("Server video upload error (fallback to local blob):", uploadErr);
        }
      }

      // Only persist remote video URLs (never blob: URLs from local preview)
      if (finalVideoUrl && !finalVideoUrl.startsWith("http")) {
        finalVideoUrl = undefined;
      }

      // 2. Prepare steps array
      let formattedSteps: SopStep[] = [];
      if (recordMode === "snapshots" && steps.length > 0) {
        formattedSteps = steps.map((s, idx) => ({
          ...s,
          step_number: idx + 1,
        }));
      } else if (recordMode === "video" && transcript.length > 0) {
        formattedSteps = transcript.map((line, idx) => ({
          id: line.id || `sop-step-${Date.now()}-${idx + 1}`,
          step_number: idx + 1,
          title: line.text.length > 60 ? `${line.text.slice(0, 58)}...` : line.text,
          description: line.text,
          timestamp: line.t,
          seconds: line.seconds != null ? line.seconds : parseTimeToSeconds(line.t),
          media_type: "video_embed",
          video_url: finalVideoUrl && finalVideoUrl.startsWith("http") ? finalVideoUrl : undefined,
          pro_tip: idx === 0 ? "Ensure you verify all fields on this screen before approving." : undefined,
        }));
      } else {
        formattedSteps = steps.length > 0 ? steps : [
          {
            id: `sop-step-${Date.now()}-1`,
            step_number: 1,
            title: title || "Step 1: First action",
            description: "Follow the visual walkthrough instructions.",
            media_type: "image",
          },
        ];
      }

      await onSaveSop(formattedSteps, {
        id: initialSop?.id,
        slug: currentSlug,
        title: title || (recordMode === "snapshots" ? "Scribe Process Guide" : "Video SOP Guide"),
        category,
        target_role: targetRole,
        summary:
          recordMode === "snapshots"
            ? `Step-by-step Scribe guide for ${targetRole.toUpperCase()} team (${formattedSteps.length} action steps).`
            : `Video guide for ${targetRole.toUpperCase()} team (Duration: ${formatSeconds(trimEnd - trimStart)}).`,
        video_url: recordMode === "video" ? finalVideoUrl : undefined,
        transcript: recordMode === "video" && transcript.length > 0 ? transcript : undefined,
        author: initialSop?.author,
        created_at: initialSop?.created_at,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromStudio = () => {
    if (!initialSop) {
      onClose();
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${title || initialSop.title}"? This cannot be undone.`)) {
      return;
    }
    if (onDeleteSop) {
      onDeleteSop(initialSop.id || initialSop.slug);
    }
  };

  if (!isOpen) return null;

  const hiddenLivePreview = (
    <video
      ref={liveVideoElementRef}
      autoPlay
      muted
      playsInline
      className="fixed left-0 top-0 h-px w-px opacity-0 pointer-events-none"
      aria-hidden="true"
    />
  );

  const recordingHud = (
    <div
      className={`font-['Manrope',system-ui,sans-serif] pointer-events-auto select-none ${
        pipMountNode ? "" : "fixed bottom-6 left-6 z-[99999] animate-fadeIn"
      }`}
    >
      {snapFlash && (
        <div
          className={`rounded-full bg-[#c4a35a] px-4 py-1.5 text-xs font-bold text-black shadow-2xl ${
            pipMountNode ? "mb-2" : "absolute -top-12 left-0 animate-bounce"
          }`}
        >
          {snapFlash}
        </div>
      )}

      {pipOpenFailed && !pipMountNode && (
        <button
          type="button"
          onClick={() => openRecordingPipWindow()}
          className="mb-2 rounded-full border border-[#c4a35a]/50 bg-[#1c1913] px-3 py-1 text-[11px] font-semibold text-[#dcc084] hover:bg-[#252018]"
        >
          Float controls on screen
        </button>
      )}

      <div className="flex items-center gap-2.5 sm:gap-3 rounded-full border border-white/15 bg-[#121214]/95 px-4 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <div className="flex items-center gap-2 pr-2.5 border-r border-white/10">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              recordMode === "snapshots" ? "bg-[#c4a35a]" : "bg-[#cf603c] animate-pulse"
            }`}
          />
          <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-[#f4f2ee]">
            {formatSeconds(recordingSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-[3px] h-[16px] pr-2.5 border-r border-white/10">
          {micLevel.map((height, i) => (
            <span
              key={i}
              style={{ height: `${Math.min(16, height * 0.7)}px` }}
              className="w-[2.5px] rounded-sm bg-[#5fbf7d] transition-all duration-75"
            />
          ))}
        </div>

        {recordMode === "snapshots" && (
          <button
            type="button"
            onClick={handleCaptureSnapshotStep}
            className="flex items-center gap-1.5 rounded-full bg-[#c4a35a] px-3.5 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-md transition"
            title="Screenshot this step (S or Space)"
          >
            <span>📸</span>
            <span>Snap Step</span>
            <span className="rounded bg-black/20 px-1.5 py-0.2 font-mono text-[10px]">
              {steps.length}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleTogglePause}
          className="flex items-center gap-1.5 rounded-full bg-[#222224] px-3 py-1.5 text-xs font-semibold text-[#f4f2ee]/80 hover:bg-[#2c2c30] transition"
        >
          {isPaused ? (
            <>
              <span className="text-[10px]">▶</span>
              <span>Resume</span>
            </>
          ) : (
            <>
              <span className="flex gap-0.5">
                <span className="w-[2px] h-[9px] bg-current rounded-sm" />
                <span className="w-[2px] h-[9px] bg-current rounded-sm" />
              </span>
              <span>Pause</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleFinishRecording}
          className="flex items-center gap-1.5 rounded-full bg-[#5fbf7d] px-3.5 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#72d392] shadow-md transition"
        >
          <span className="h-2 w-2 rounded-sm bg-[#0a0a0a]" />
          <span>
            Finish ({steps.length || 1} {steps.length === 1 ? "Step" : "Steps"})
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            cleanupStreams();
            setStage("setup");
          }}
          title="Cancel recording"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#f4f2ee]/40 hover:text-[#f4f2ee] hover:bg-white/10 text-xs transition ml-0.5"
        >
          ✕
        </button>
      </div>
    </div>
  );

  // ========================================================
  // FRAME 2 · ACTIVE RECORDING (UNOBTRUSIVE FLOATING HUD)
  // ========================================================
  if (stage === "recording") {
    return (
      <>
        {hiddenLivePreview}
        {pipMountNode ? createPortal(recordingHud, pipMountNode) : recordingHud}
      </>
    );
  }

  return (
    <>
      {hiddenLivePreview}
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/88 backdrop-blur-md p-3 sm:p-6 font-['Manrope',system-ui,sans-serif] animate-fadeIn">
      {/* Container */}
      <div className="relative flex h-[92vh] w-full max-w-[1400px] flex-col rounded-2xl border border-white/10 bg-[#0a0a0a] text-[#f4f2ee] shadow-2xl overflow-hidden">
        
        {/* ======================================================== */}
        {/* FRAME 1 · SETUP & MODE SELECTION MODAL                  */}
        {/* ======================================================== */}
        {stage === "setup" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-y-auto min-h-0">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f4f2ee] hover:bg-[#1a1a1a] transition"
            >
              ✕
            </button>

            <div className="w-full max-w-[680px] rounded-[20px] border border-white/12 bg-[#141414] p-6 sm:p-8 shadow-[0_40px_120px_rgba(0,0,0,0.7)] space-y-5">
              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-[#f4f2ee] leading-tight">
                  Record SOP
                </div>
                <p className="text-sm text-[#f4f2ee]/50">
                  Pick a style, fill in the basics, then start.
                </p>
              </div>

              {/* Mode Switcher Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mode A: Scribe Snapshot Mode */}
                <div
                  onClick={() => setRecordMode("snapshots")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    recordMode === "snapshots"
                      ? "border-[#c4a35a] bg-[#1c1913] shadow-[0_0_20px_rgba(196,163,90,0.15)] ring-1 ring-[#c4a35a]/40"
                      : "border-white/10 bg-[#0f0f0f] hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#dcc084]">
                    <span>📸</span> Snapshots
                  </span>
                  <p className="text-xs text-[#cfc9c2] mt-1.5">
                    Capture a screenshot at each step. Add pins and blur after.
                  </p>
                </div>

                {/* Mode B: Full Video Mode */}
                <div
                  onClick={() => setRecordMode("video")}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    recordMode === "video"
                      ? "border-[#c4a35a] bg-[#1c1913] shadow-[0_0_20px_rgba(196,163,90,0.15)] ring-1 ring-[#c4a35a]/40"
                      : "border-white/10 bg-[#0f0f0f] hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#dcc084]">
                    <span>🎥</span> Video
                  </span>
                  <p className="text-xs text-[#cfc9c2] mt-1.5">
                    Record your screen and voice. Transcript builds automatically.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#c4a35a]/25 bg-[#16140f] px-3.5 py-3 text-xs text-[#cfc9c2] space-y-1.5">
                <p>
                  <span className="font-semibold text-[#dcc084]">Screen share:</span> choose{" "}
                  <span className="text-[#f4f2ee]">Entire screen</span> or{" "}
                  <span className="text-[#f4f2ee]">Chrome window</span> so captures work in any tab.
                </p>
                {isDocumentPipSupported() ? (
                  <p>
                    <span className="font-semibold text-[#dcc084]">Floating controls:</span> a small
                    bar stays on top while you work in other tabs and apps (Chrome / Edge).
                  </p>
                ) : (
                  <p>
                    For floating controls across tabs, use Chrome or Edge. Safari keeps the bar on this
                    tab only.
                  </p>
                )}
              </div>

              {/* Active Mic Pill */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/9 bg-[#1a1a1a] px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[#5fbf7d]" />
                <span className="text-xs text-[#f4f2ee]/75">
                  Mic {micActive ? "on" : "ready"}
                </span>
                <div className="flex items-end gap-[3px] h-[14px]">
                  {micLevel.map((height, i) => (
                    <span
                      key={i}
                      style={{ height: `${height}px` }}
                      className="w-[3px] rounded-sm bg-[#5fbf7d] transition-all duration-75"
                    />
                  ))}
                </div>
              </div>

              {/* Form Metadata */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#f4f2ee]/45">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Early check-in approval"
                    className="w-full rounded-lg border border-[#c4a35a]/45 bg-[#0e0e0e] px-3.5 py-2.5 text-sm font-medium text-[#f4f2ee] outline-none focus:border-[#c4a35a]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#f4f2ee]/45">
                      For
                    </label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as SopTargetRole)}
                      className="w-full rounded-lg border border-white/8 bg-[#0e0e0e] px-3 py-2 text-xs text-[#f4f2ee] outline-none"
                    >
                      <option value="va">VA Team</option>
                      <option value="cleaner">Cleaner</option>
                      <option value="manager">Operations Manager</option>
                      <option value="all">Everyone</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#f4f2ee]/45">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as SopCategory)}
                      className="w-full rounded-lg border border-white/8 bg-[#0e0e0e] px-3 py-2 text-xs text-[#f4f2ee] outline-none"
                    >
                      <option value="turnover">Turnovers &amp; Cleaning</option>
                      <option value="guest_ops">Guest Comms</option>
                      <option value="outreach">Outreach &amp; Leads</option>
                      <option value="team_comms">Team Comms</option>
                      <option value="software">Software</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartRecording(recordMode)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#c4a35a] py-3 text-sm font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-[0_12px_40px_rgba(196,163,90,0.3)] transition"
                >
                  <span className="h-2 w-2 rounded-full bg-[#cf603c] animate-pulse" />
                  <span>
                    {recordMode === "snapshots" ? "Start Snapshots" : "Start Video"}
                  </span>
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
        {/* FRAME 3 · REVIEW & SCRIBE REDACTOR STUDIO               */}
        {/* ======================================================== */}
        {stage === "review" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
            {/* Top Bar Header */}
            <div className="h-16 sm:h-[72px] flex items-center justify-between gap-4 px-6 bg-[#0e0e0e] border-b border-white/8 shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-6 w-6 rounded-md bg-[#c4a35a] flex items-center justify-center text-xs font-bold text-black shrink-0">
                  {recordMode === "snapshots" ? "📸" : "🎥"}
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="SOP Title"
                  className="flex-1 min-w-0 rounded-lg border border-white/8 bg-[#141414] px-3.5 py-2 text-[15px] sm:text-base font-semibold text-[#f4f2ee] outline-none focus:border-[#c4a35a]/50"
                />
              </div>

              <div className="flex items-center gap-3">
                {trimAppliedToast && (
                  <span className="rounded-md bg-[#4ea882]/20 border border-[#4ea882]/40 px-3 py-1.5 text-xs font-semibold text-[#4ea882] animate-fadeIn">
                    ✓ Trim Range Applied
                  </span>
                )}

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SopCategory)}
                  className="rounded-lg border border-white/8 bg-[#141414] px-3 py-2 text-xs text-[#f4f2ee]/70 outline-none"
                >
                  <option value="turnover">Turnovers &amp; Cleaning</option>
                  <option value="guest_ops">Guest Comms</option>
                  <option value="software">Software &amp; Settings</option>
                  <option value="team_comms">Team Comms</option>
                  <option value="outreach">Outreach</option>
                  <option value="maintenance">Maintenance</option>
                </select>

                {initialSop && onDeleteSop && (
                  <button
                    type="button"
                    onClick={handleDeleteFromStudio}
                    className="rounded-lg border border-[#cf603c]/30 bg-[#cf603c]/10 px-3.5 py-2 text-xs font-semibold text-[#e8a48a] hover:bg-[#cf603c]/20 transition shrink-0"
                  >
                    Delete Guide
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveToPlaybook}
                  disabled={isSaving}
                  className="rounded-lg bg-[#c4a35a] px-5 py-2.5 text-xs sm:text-sm font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-[0_10px_32px_rgba(196,163,90,0.3)] transition shrink-0 disabled:opacity-50"
                >
                  {isSaving ? "Saving to Playbook..." : initialSop ? "Save Changes ✓" : "Save Guide to Playbook ✓"}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  title="Close Studio"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f4f2ee] hover:bg-[#1a1a1a] transition shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SUB-VIEW A: SCRIBE SNAPSHOTS & REDACTION REVIEW          */}
            {/* ======================================================== */}
            {recordMode === "snapshots" ? (
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* Steps List Main Column */}
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-[#f4f2ee] flex items-center gap-2">
                        <span>Captured Step Snapshots</span>
                        <span className="rounded bg-[#c4a35a]/20 border border-[#c4a35a]/40 px-2 py-0.5 text-xs font-mono text-[#dcc084]">
                          {steps.length} {steps.length === 1 ? "Step" : "Steps"}
                        </span>
                      </h3>
                      <p className="text-xs text-[#f4f2ee]/50">
                        Click "Redact &amp; Annotate" on any screenshot to add click pins, spotlight boxes, or blur private customer info.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddBlankStep}
                      className="rounded-lg border border-[#c4a35a]/40 bg-[#1a1712] px-3.5 py-2 text-xs font-bold text-[#dcc084] hover:bg-[#c4a35a]/20 transition"
                    >
                      + Add Step
                    </button>
                  </div>

                  {/* Step Cards List */}
                  <div className="space-y-5">
                    {steps.map((step, idx) => (
                      <div
                        key={step.id || idx}
                        className="rounded-xl border border-white/9 bg-[#141414] p-5 space-y-4 shadow-lg hover:border-white/15 transition"
                      >
                        {/* Top Step Row: Number + Title + Delete */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c4a35a] font-mono text-xs font-bold text-black shrink-0">
                              0{idx + 1}
                            </span>
                            <input
                              type="text"
                              value={step.title}
                              onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                              placeholder={`Step ${idx + 1} Title`}
                              className="flex-1 min-w-0 rounded-md border border-white/8 bg-[#0a0a0a] px-3 py-1.5 text-sm font-semibold text-[#f4f2ee] outline-none focus:border-[#c4a35a]"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            {step.timestamp && (
                              <span className="font-mono text-xs text-[#dcc084] bg-[#c4a35a]/10 px-2 py-1 rounded border border-[#c4a35a]/25">
                                {step.timestamp}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteStep(idx)}
                              className="text-xs text-[#cf603c]/70 hover:text-[#cf603c] p-1"
                              title="Delete step"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <textarea
                          rows={2}
                          value={step.description}
                          onChange={(e) => handleUpdateStep(idx, { description: e.target.value })}
                          placeholder="Describe what the team member should do in this step..."
                          className="w-full rounded-md border border-white/8 bg-[#0a0a0a] p-3 text-xs sm:text-[13px] leading-relaxed text-[#f4f2ee] outline-none focus:border-[#c4a35a]"
                        />

                        {/* Screenshot Box & Redact Toolbar */}
                        {step.image_url ? (
                          <div className="space-y-2.5">
                            <div className="relative rounded-lg border border-white/10 bg-[#0e0e0e] overflow-hidden group max-h-[380px] flex items-center justify-center">
                              <img
                                src={step.image_url}
                                alt={step.title}
                                className="w-full h-auto max-h-[360px] object-contain rounded"
                              />

                              {/* Hover Redact Overlay */}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] flex items-center justify-center gap-3 transition">
                                <button
                                  type="button"
                                  onClick={() => setActiveRedactorStepIdx(idx)}
                                  className="rounded-lg bg-[#c4a35a] px-4 py-2 text-xs font-bold text-black shadow-xl hover:scale-105 transition"
                                >
                                  ✏️ Redact &amp; Add Click Pins
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2 text-[#f4f2ee]/50">
                                {step.pins && step.pins.length > 0 && (
                                  <span className="rounded bg-[#c4a35a]/15 border border-[#c4a35a]/30 px-2 py-0.5 text-[#dcc084] font-medium">
                                    {step.pins.length} Click {step.pins.length === 1 ? "Pin" : "Pins"} Added
                                  </span>
                                )}
                                {step.boxes && step.boxes.length > 0 && (
                                  <span className="rounded bg-white/10 px-2 py-0.5 text-[#cfc9c2]">
                                    {step.boxes.length} Redaction/Spotlight {step.boxes.length === 1 ? "Box" : "Boxes"}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => setActiveRedactorStepIdx(idx)}
                                className="rounded border border-[#c4a35a]/40 bg-[#1a1712] px-3 py-1.5 font-semibold text-[#dcc084] hover:bg-[#c4a35a]/20 transition"
                              >
                                ✏️ Open Image Redactor
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-white/15 p-5 text-center space-y-2 bg-[#0e0e0e]">
                            <p className="text-xs text-[#f4f2ee]/50">No screenshot attached for this step.</p>
                            <label className="inline-block rounded border border-white/10 bg-[#161616] px-3 py-1.5 text-xs font-semibold text-[#cfc9c2] hover:text-white cursor-pointer">
                              Upload Screenshot
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const url = ev.target?.result as string;
                                      handleUpdateStep(idx, { image_url: url, raw_image_url: url });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}

                        {/* Pro tip / Warning inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <input
                            type="text"
                            value={step.pro_tip || ""}
                            onChange={(e) => handleUpdateStep(idx, { pro_tip: e.target.value || undefined })}
                            placeholder="💡 Pro Tip (Optional)"
                            className="rounded border border-white/8 bg-[#0a0a0a] px-3 py-2 text-xs text-[#cfc9c2] outline-none focus:border-[#c4a35a]"
                          />
                          <input
                            type="text"
                            value={step.warning || ""}
                            onChange={(e) => handleUpdateStep(idx, { warning: e.target.value || undefined })}
                            placeholder="⚠️ Warning / Careful (Optional)"
                            className="rounded border border-white/8 bg-[#0a0a0a] px-3 py-2 text-xs text-[#cfc9c2] outline-none focus:border-[#cf603c]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Metadata / Quick Action Sidebar */}
                <div className="w-full lg:w-[320px] p-6 border-t lg:border-t-0 lg:border-l border-white/8 space-y-6 shrink-0 bg-[#0c0c0e]">
                  <div className="space-y-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#c4a35a]">
                      Scribe Summary
                    </span>
                    <h4 className="text-sm font-bold text-[#f4f2ee]">Step-by-Step Playbook</h4>
                    <p className="text-xs text-[#f4f2ee]/50 leading-relaxed">
                      This guide will be published with annotated screenshots, zoomable lightboxes, and click pins for your team.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStage("setup");
                        setSteps([]);
                      }}
                      className="w-full rounded-lg border border-white/10 bg-[#141414] py-2.5 text-xs font-semibold text-[#f4f2ee]/70 hover:text-white transition"
                    >
                      Record New Process
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveToPlaybook}
                      disabled={isSaving}
                      className="w-full rounded-lg bg-[#c4a35a] py-3 text-xs sm:text-sm font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-lg transition disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Publish to Playbook ✓"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ======================================================== */
              /* SUB-VIEW B: FULL VIDEO PLAYBACK & TRANSCRIPT STUDIO     */
              /* ======================================================== */
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
                {/* Left Column: Video Player & Controls */}
                <div className="w-full lg:w-[620px] xl:w-[740px] p-6 border-b lg:border-b-0 lg:border-r border-white/7 flex flex-col gap-4 overflow-y-auto shrink-0">
                  {/* Video Player Box */}
                  <div className="relative h-[290px] sm:h-[380px] rounded-xl border border-white/9 bg-[#141414] overflow-hidden flex items-center justify-center group shadow-xl">
                    {videoBlobUrl ? (
                      <video
                        ref={reviewVideoRef}
                        src={videoBlobUrl}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={handleTogglePlay}
                        onTimeUpdate={(e) => {
                          const cur = e.currentTarget.currentTime;
                          setPlaybackTime(cur);
                          if (cur >= trimEnd) {
                            if (reviewVideoRef.current) {
                              reviewVideoRef.current.pause();
                              reviewVideoRef.current.currentTime = trimStart;
                            }
                            setIsPlaying(false);
                            setPlaybackTime(trimStart);
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          const d = e.currentTarget.duration;
                          if (d && !isNaN(d) && isFinite(d) && d > 0) {
                            setDuration(d);
                            setTrimEnd(d);
                          } else if (recordingSeconds > 0) {
                            setDuration(recordingSeconds);
                            setTrimEnd(recordingSeconds);
                          }
                          if (reviewVideoRef.current) {
                            reviewVideoRef.current.volume = volume;
                            reviewVideoRef.current.muted = false;
                          }
                        }}
                        onEnded={() => {
                          setIsPlaying(false);
                          if (reviewVideoRef.current) {
                            reviewVideoRef.current.currentTime = trimStart;
                          }
                          setPlaybackTime(trimStart);
                        }}
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
                          screen recording · playback ready
                        </span>
                      </div>
                    )}

                    {!isPlaying && videoBlobUrl && (
                      <div
                        onClick={handleTogglePlay}
                        className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer group-hover:bg-black/20 transition"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#c4a35a] text-[#0a0a0a] shadow-2xl group-hover:scale-105 transition">
                          <div className="ml-1 w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-[#0a0a0a]" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timeline Scrubber & Player Bar */}
                  <div className="rounded-xl border border-white/8 bg-[#141414] p-4 space-y-3.5">
                    <div className="space-y-1">
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pos = (e.clientX - rect.left) / rect.width;
                          handleSeek(pos * duration);
                        }}
                        className="relative h-2 rounded-full bg-white/9 cursor-pointer"
                      >
                        <div
                          style={{ width: `${(playbackTime / duration) * 100}%` }}
                          className="absolute inset-y-0 left-0 rounded-full bg-[#c4a35a]"
                        />
                        <div
                          style={{ left: `${(playbackTime / duration) * 100}%` }}
                          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-[#dcc084] shadow-[0_0_0_4px_rgba(196,163,90,0.3)]"
                        />

                        {transcript.map((item) => {
                          const pct = Math.min(100, Math.max(0, (item.seconds / duration) * 100));
                          return (
                            <div
                              key={item.id}
                              style={{ left: `${pct}%` }}
                              className="absolute -top-1 h-4 w-[2px] bg-[#c4a35a]/80"
                              title={`${item.t}: ${item.text}`}
                            />
                          );
                        })}
                      </div>
                    </div>

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

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
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
                  </div>

                  {/* Video Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStage("trimming")}
                      className="flex items-center gap-2 rounded-lg border border-[#c4a35a]/50 bg-[#1a1712] px-4 py-2.5 text-xs font-bold text-[#dcc084] hover:bg-[#c4a35a]/20 transition"
                    >
                      <span>✂</span>
                      <span>Trim Recording</span>
                    </button>

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

                {/* Right Column: Voice Transcript */}
                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-[15px] font-bold tracking-tight text-[#f4f2ee]">Voice Transcript</h4>
                      <p className="text-xs text-[#f4f2ee]/45">
                        {transcript.length > 0
                          ? "Click a timestamp to jump. Click any line to rewrite it."
                          : "No spoken audio was detected on this recording."}
                      </p>
                    </div>
                    {transcript.length > 0 ? (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#c4a35a]">
                        auto · transcribed
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#f4f2ee]/40 rounded bg-white/5 px-2 py-0.5 border border-white/10">
                        no audio found
                      </span>
                    )}
                  </div>

                  {/* Transcript List */}
                  <div className="flex-1 flex flex-col gap-2.5 p-4 bg-[#141414] border border-white/8 rounded-xl overflow-y-auto">
                    {transcript.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[#f4f2ee]/40">
                          <span className="text-base">🎙</span>
                        </div>
                        <div className="space-y-1.5 max-w-sm">
                          <p className="text-sm font-semibold text-[#f4f2ee]/85">No audio detected</p>
                          <p className="text-xs leading-relaxed text-[#f4f2ee]/45">
                            We didn't detect any spoken words. You can save this video directly, or click below to add manual step timestamps.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddLine}
                          className="rounded-lg border border-[#c4a35a]/40 bg-[#1a1712] px-3.5 py-1.5 text-xs font-semibold text-[#dcc084] hover:bg-[#c4a35a]/20 transition mt-1"
                        >
                          + Add step at current timestamp
                        </button>
                      </div>
                    ) : (
                      transcript.map((line) => {
                        const isEditing = editingTranscriptId === line.id;

                        if (isEditing) {
                          return (
                            <div
                              key={line.id}
                              className="flex gap-3 p-3.5 rounded-xl bg-[#0e0e0e] border border-[#c4a35a]/60 shadow-[0_0_0_3px_rgba(196,163,90,0.09)] animate-fadeIn"
                            >
                              <button
                                type="button"
                                onClick={() => handleSeek(line.seconds != null ? line.seconds : parseTimeToSeconds(line.t))}
                                className="flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-[#c4a35a] font-mono text-[11px] font-bold text-[#0a0a0a] shrink-0"
                              >
                                <span>▶</span>
                                <span>{line.t}</span>
                              </button>

                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#dcc084]">
                                    Editing
                                  </span>
                                  <span className="font-mono text-[10px] text-[#f4f2ee]/30">
                                    ⌘↵ save · esc cancel
                                  </span>
                                </div>

                                <textarea
                                  rows={2}
                                  autoFocus
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveLine(line.id);
                                    } else if (e.key === "Escape") {
                                      setEditingTranscriptId(null);
                                    }
                                  }}
                                  className="w-full rounded-md border border-white/10 bg-[#141414] p-2.5 text-[13.5px] leading-relaxed text-[#f4f2ee] outline-none focus:border-[#c4a35a]"
                                />

                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveLine(line.id)}
                                    className="rounded-md bg-[#c4a35a] px-3.5 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] transition"
                                  >
                                    Save line
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTranscriptId(null)}
                                    className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-[#f4f2ee]/60 hover:text-white transition"
                                  >
                                    Cancel
                                  </button>
                                  <div className="flex-1" />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLine(line.id)}
                                    className="text-xs text-[#cf603c]/70 hover:text-[#cf603c] transition"
                                  >
                                    Delete line
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={line.id}
                            onClick={() => handleStartEditLine(line)}
                            className="group flex gap-3 p-3 rounded-lg bg-[#0e0e0e] border border-white/7 hover:border-[#c4a35a]/40 cursor-pointer transition"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSeek(line.seconds != null ? line.seconds : parseTimeToSeconds(line.t));
                              }}
                              className="flex items-center gap-1 h-[22px] px-2 rounded-md bg-[#c4a35a]/12 border border-[#c4a35a]/35 font-mono text-[11px] font-medium text-[#dcc084] hover:bg-[#c4a35a] hover:text-[#0a0a0a] transition shrink-0"
                            >
                              <span>▶</span>
                              <span>{line.t}</span>
                            </button>

                            <div className="flex-1 space-y-0.5 min-w-0">
                              <p className="text-[13.5px] leading-relaxed text-[#f4f2ee]/85 group-hover:text-white transition">
                                {line.text}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Actions for Transcript */}
                  <div className="flex items-center gap-4 pt-1">
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-xs font-semibold text-[#f4f2ee]/45 hover:text-[#dcc084] transition"
                    >
                      + Add a line
                    </button>
                    <button
                      type="button"
                      onClick={handleTidyWording}
                      className="text-xs font-semibold text-[#f4f2ee]/45 hover:text-[#dcc084] transition"
                    >
                      Tidy wording
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* FRAME 4 · DEDICATED TRIMMER VIEW                        */}
        {/* ======================================================== */}
        {stage === "trimming" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a] animate-fadeIn">
            <div className="h-16 sm:h-[78px] flex items-center justify-between gap-4 px-6 bg-[#0e0e0e] border-b border-white/8 shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-6 w-6 rounded-md bg-[#c4a35a] shrink-0" />
                <div className="text-base font-semibold text-[#f4f2ee] truncate">
                  Trimming · {title}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDiscardTrim}
                  className="text-xs sm:text-sm text-[#f4f2ee]/45 hover:text-white transition"
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  onClick={handleApplyTrim}
                  className="rounded-lg bg-[#c4a35a] px-5 py-2.5 text-xs sm:text-sm font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-[0_10px_32px_rgba(196,163,90,0.3)] transition"
                >
                  Apply Trim
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  title="Close Studio"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f4f2ee] hover:bg-[#1a1a1a] transition shrink-0 ml-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
              <div className="relative flex-1 min-h-[260px] rounded-xl border border-white/9 bg-[#141414] overflow-hidden flex items-center justify-center">
                {videoBlobUrl ? (
                  <video
                    ref={trimVideoRef}
                    src={videoBlobUrl}
                    className="w-full h-full object-contain"
                    onClick={handleTogglePlay}
                    onTimeUpdate={(e) => {
                      const cur = e.currentTarget.currentTime;
                      setPlaybackTime(cur);
                      if (cur >= trimEnd) {
                        if (trimVideoRef.current) {
                          trimVideoRef.current.pause();
                          trimVideoRef.current.currentTime = trimStart;
                        }
                        setIsPlaying(false);
                        setPlaybackTime(trimStart);
                      }
                    }}
                    playsInline
                  />
                ) : (
                  <div className="font-mono text-xs uppercase tracking-widest text-[#f4f2ee]/40">
                    frame at {formatSeconds(trimStart)} · trim start
                  </div>
                )}

                <div className="absolute top-4 left-4 rounded-md bg-black/75 px-3 py-1 font-mono text-[10px] tracking-wider text-[#dcc084] border border-[#c4a35a]/30">
                  TRIM MODE
                </div>

                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTrimStart(playbackTime)}
                    className="rounded-md bg-black/75 border border-white/10 px-3 py-1 text-xs text-[#f4f2ee]/70 hover:text-white"
                  >
                    Set Start ({formatSeconds(playbackTime)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrimEnd(playbackTime)}
                    className="rounded-md bg-black/75 border border-white/10 px-3 py-1 text-xs text-[#f4f2ee]/70 hover:text-white"
                  >
                    Set End ({formatSeconds(playbackTime)})
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-[#141414] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">Timeline</span>
                    <span className="font-mono text-xs text-[#dcc084]">
                      Keeping {formatSeconds(trimStart)} → {formatSeconds(trimEnd)} · {formatSeconds(trimEnd - trimStart)} final
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#f4f2ee]/35 hidden sm:inline">
                    Drag the gold handles or click timeline
                  </span>
                </div>

                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const clickedTime = pct * duration;
                    handleSeek(clickedTime);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const newTime = pct * duration;

                    if (isDraggingTrimStart) {
                      const clampedStart = Math.max(0, Math.min(newTime, trimEnd - 0.5));
                      setTrimStart(clampedStart);
                      handleSeek(clampedStart);
                    } else if (isDraggingTrimEnd) {
                      const clampedEnd = Math.min(duration, Math.max(newTime, trimStart + 0.5));
                      setTrimEnd(clampedEnd);
                      handleSeek(clampedEnd);
                    }
                  }}
                  onMouseUp={() => {
                    setIsDraggingTrimStart(false);
                    setIsDraggingTrimEnd(false);
                  }}
                  onMouseLeave={() => {
                    setIsDraggingTrimStart(false);
                    setIsDraggingTrimEnd(false);
                  }}
                  className="relative h-20 rounded-lg bg-[#0b0b0b] border border-white/7 overflow-hidden select-none cursor-pointer"
                >
                  <div className="absolute inset-0 flex items-center gap-[3px] px-2 opacity-40">
                    {Array.from({ length: 44 }).map((_, i) => (
                      <div
                        key={i}
                        style={{ height: `${20 + ((i * 17) % 65)}%` }}
                        className="flex-1 bg-[#444] rounded-sm"
                      />
                    ))}
                  </div>

                  <div
                    style={{ width: `${(trimStart / duration) * 100}%` }}
                    className="absolute inset-y-0 left-0 bg-black/80"
                  />

                  <div
                    style={{ width: `${((duration - trimEnd) / duration) * 100}%` }}
                    className="absolute inset-y-0 right-0 bg-black/80"
                  />

                  <div
                    style={{
                      left: `${(trimStart / duration) * 100}%`,
                      width: `${((trimEnd - trimStart) / duration) * 100}%`,
                    }}
                    className="absolute inset-y-0 border-2 border-[#c4a35a] rounded-lg shadow-[0_0_0_1px_rgba(196,163,90,0.25)_inset]"
                  />

                  <div
                    style={{ left: `${(trimStart / duration) * 100}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingTrimStart(true);
                    }}
                    className="absolute inset-y-0 w-4 -ml-2 rounded-md bg-[#c4a35a] cursor-ew-resize flex items-center justify-center shadow-lg"
                  >
                    <span className="w-0.5 h-6 bg-black/60 rounded-full" />
                  </div>

                  <div
                    style={{ left: `${(trimEnd / duration) * 100}%` }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingTrimEnd(true);
                    }}
                    className="absolute inset-y-0 w-4 -ml-2 rounded-md bg-[#c4a35a] cursor-ew-resize flex items-center justify-center shadow-lg"
                  >
                    <span className="w-0.5 h-6 bg-black/60 rounded-full" />
                  </div>

                  <div
                    style={{ left: `${(playbackTime / duration) * 100}%` }}
                    className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_white]"
                  />
                </div>

                <div className="flex items-center justify-between flex-wrap gap-4">
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

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="rounded-md border border-white/10 bg-[#0e0e0e] px-3 py-1.5 text-[#dcc084]">
                      Start {formatSeconds(trimStart)}
                    </span>
                    <span className="rounded-md border border-white/10 bg-[#0e0e0e] px-3 py-1.5 text-[#dcc084]">
                      End {formatSeconds(trimEnd)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Embedded Image Redactor Modal for Scribe Annotation & Redaction */}
      {activeRedactorStepIdx !== null && steps[activeRedactorStepIdx] && (
        <ImageRedactorModal
          isOpen={true}
          initialImageUrl={steps[activeRedactorStepIdx].image_url}
          rawImageUrl={steps[activeRedactorStepIdx].raw_image_url}
          initialBoxes={steps[activeRedactorStepIdx].boxes}
          initialPins={steps[activeRedactorStepIdx].pins}
          onClose={() => setActiveRedactorStepIdx(null)}
          onSave={(bakedDataUrl, boxes, pins, rawImageUrl) => {
            handleUpdateStep(activeRedactorStepIdx, {
              image_url: bakedDataUrl,
              raw_image_url: rawImageUrl || steps[activeRedactorStepIdx].raw_image_url || bakedDataUrl,
              boxes,
              pins,
            });
            setActiveRedactorStepIdx(null);
          }}
        />
      )}
    </div>
    </>
  );
}
