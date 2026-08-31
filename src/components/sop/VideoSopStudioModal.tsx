import { useState, useRef, useEffect } from "react";
import type { SopItem, SopStep, SopCategory, SopTargetRole } from "../../../shared/pm/sopTypes";
import { storeSopVideoBlob, getSopVideoBlob } from "../../lib/sopVideoStorage";
import { pmPost } from "../../pages/clients/api";

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

// Modal Stages: 'setup' | 'recording' | 'review' | 'trimming' | 'saved'
export function VideoSopStudioModal({ isOpen, initialSop, onClose, onDeleteSop, onSaveSop }: VideoSopStudioModalProps) {
  const [stage, setStage] = useState<"setup" | "recording" | "review" | "trimming" | "saved">("setup");
  const [isSaving, setIsSaving] = useState(false);

  // SOP Metadata
  const [title, setTitle] = useState("");
  const [targetRole, setTargetRole] = useState<SopTargetRole>("va");
  const [category, setCategory] = useState<SopCategory>("turnover");

  // Recording State & Media
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [micLevel, setMicLevel] = useState<number[]>([14, 18, 22, 10, 20, 16]);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);

  // Transcript lines (Empty when no audio detected)
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

  // Sync with initialSop when modal is opened for editing
  useEffect(() => {
    if (isOpen) {
      if (initialSop) {
        setTitle(initialSop.title || "Video SOP Guide");
        setTargetRole(initialSop.target_role || "va");
        setCategory(initialSop.category || "turnover");

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
        setTranscript([]);
        setTitle("");
        setVideoBlobUrl(null);
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
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
      setTrimStart(0);
      setTrimEnd(102);
      setEditingTranscriptId(null);
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

  // Start real recording (Screen + Microphone with Audio Mixer)
  const handleStartRecording = async () => {
    try {
      // 1. Get Screen Stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });
      screenStreamRef.current = screenStream;

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

      // 3. AUDIO MIXER VIA AudioContext:
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

      // 4. Combine Video Track + the ONE Unified Audio Track
      const mixedAudioTracks = audioDestination.stream.getAudioTracks();
      const combinedTracks: MediaStreamTrack[] = [
        ...screenStream.getVideoTracks(),
        ...mixedAudioTracks,
      ];
      const combinedStream = new MediaStream(combinedTracks);

      // 5. Start MediaRecorder
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

      // 6. Speech Recognition
      initSpeechRecognition();

      // 7. Transition to Recording Stage
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recordingStartTimeRef.current = Date.now();
      setIsPaused(false);
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
      handleStartSimulatedRecording();
    }
  };

  // Fallback demo simulation
  const handleStartSimulatedRecording = () => {
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
                const nowElapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
                const currentSec = Math.max(0, recordingSecondsRef.current || nowElapsed);
                const mins = Math.floor(currentSec / 60);
                const secs = (currentSec % 60).toString().padStart(2, "0");
                const timeStr = `${mins}:${secs}`;
                liveTranscripts.push({
                  id: `tr-${Date.now()}-${i}`,
                  t: timeStr,
                  seconds: currentSec,
                  who: `Step ${liveTranscripts.length + 1}`,
                  text,
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
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
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
    const totalSecs = Math.max(3, recordingSecondsRef.current || recordingSeconds || 17);
    setDuration(totalSecs);
    setTrimStart(0);
    setTrimEnd(totalSecs);
    setPlaybackTime(0);
    setIsPlaying(false);
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

  const formatSeconds = (sec: number) => {
    const valid = Math.max(0, isNaN(sec) ? 0 : sec);
    const m = Math.floor(valid / 60);
    const s = Math.floor(valid % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  // Transcript Editing Handlers
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

    // Filter and shift transcript to match the trimmed range
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

      // 1. Cache to IndexedDB for instantaneous local access
      if (recordedBlobRef.current) {
        await storeSopVideoBlob(currentSlug, recordedBlobRef.current);

        // 2. Upload to server storage (pm-contracts bucket under sop-videos/)
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

      const formattedSteps: SopStep[] =
        transcript.length > 0
          ? transcript.map((line, idx) => ({
              id: line.id || `sop-step-${Date.now()}-${idx + 1}`,
              step_number: idx + 1,
              title: line.text.length > 60 ? `${line.text.slice(0, 58)}...` : line.text,
              description: line.text,
              timestamp: line.t,
              seconds: line.seconds != null ? line.seconds : parseTimeToSeconds(line.t),
              media_type: "video_embed",
              video_url: finalVideoUrl,
              pro_tip:
                idx === 0
                  ? "Ensure you verify all fields on this screen before approving."
                  : undefined,
            }))
          : [
              {
                id: `sop-step-${Date.now()}-1`,
                step_number: 1,
                title: title || "Video SOP Walkthrough",
                description: "Watch the recorded video walkthrough for step-by-step instructions.",
                timestamp: "0:00",
                seconds: 0,
                media_type: "video_embed",
                video_url: finalVideoUrl,
              },
            ];

      await onSaveSop(formattedSteps, {
        id: initialSop?.id,
        slug: currentSlug,
        title: title || "Video SOP Guide",
        category,
        target_role: targetRole,
        summary: `Video guide for ${targetRole.toUpperCase()} team (Duration: ${formatSeconds(trimEnd - trimStart)}).`,
        video_url: finalVideoUrl,
        transcript: transcript.length > 0 ? transcript : undefined,
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

  // ========================================================
  // FRAME 2 · ACTIVE RECORDING (UNOBTRUSIVE FLOATING HUD)
  // ========================================================
  if (stage === "recording") {
    return (
      <div className="fixed bottom-6 left-6 z-[99999] font-['Manrope',system-ui,sans-serif] pointer-events-auto select-none animate-fadeIn">
        <div className="flex items-center gap-3 rounded-full border border-white/15 bg-[#121214]/95 px-4 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
            <span className="h-2.5 w-2.5 rounded-full bg-[#cf603c] animate-pulse" />
            <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-[#f4f2ee]">
              {formatSeconds(recordingSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-[3px] h-[16px] pr-3 border-r border-white/10">
            {micLevel.map((height, i) => (
              <span
                key={i}
                style={{ height: `${Math.min(16, height * 0.7)}px` }}
                className="w-[2.5px] rounded-sm bg-[#5fbf7d] transition-all duration-75"
              />
            ))}
          </div>

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
            className="flex items-center gap-1.5 rounded-full bg-[#c4a35a] px-3.5 py-1.5 text-xs font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-md transition"
          >
            <span className="h-2 w-2 rounded-sm bg-[#0a0a0a]" />
            <span>Finish Recording</span>
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
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/88 backdrop-blur-md p-3 sm:p-6 font-['Manrope',system-ui,sans-serif] animate-fadeIn">
      {/* Container */}
      <div className="relative flex h-[92vh] w-full max-w-[1400px] flex-col rounded-2xl border border-white/10 bg-[#0a0a0a] text-[#f4f2ee] shadow-2xl overflow-hidden">
        
        {/* ======================================================== */}
        {/* FRAME 1 · SETUP & AUDIO CHECK MODAL                     */}
        {/* ======================================================== */}
        {stage === "setup" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-[#9a9590] hover:text-[#f4f2ee] hover:bg-[#1a1a1a] transition"
            >
              ✕
            </button>

            <div className="w-full max-w-[620px] rounded-[18px] border border-white/12 bg-[#141414] p-8 sm:p-10 shadow-[0_40px_120px_rgba(0,0,0,0.7)] space-y-7">
              <div className="space-y-2.5">
                <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#f4f2ee] leading-tight">
                  Record Video SOP
                </div>
                <p className="text-sm sm:text-[15px] leading-relaxed text-[#f4f2ee]/50">
                  Record your screen and speak through the steps. We'll record the video and transcribe your voice for the team.
                </p>
              </div>

              {/* Active Mic Pill with Bouncing Green Bars */}
              <div className="inline-flex items-center gap-3.5 rounded-full border border-white/9 bg-[#1a1a1a] px-4 py-2.5">
                <span className="h-2 w-2 rounded-full bg-[#5fbf7d]" />
                <span className="text-xs sm:text-[13px] font-medium text-[#f4f2ee]/75">
                  Mic: Microphone <span className="text-[#5fbf7d] font-semibold">({micActive ? "Active" : "Ready"})</span>
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

              <div className="space-y-5">
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
        {/* FRAME 3 · REVIEW & PLAYBACK STUDIO                      */}
        {/* ======================================================== */}
        {stage === "review" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
            {/* Top Bar Header */}
            <div className="h-16 sm:h-[78px] flex items-center justify-between gap-4 px-6 bg-[#0e0e0e] border-b border-white/8 shrink-0">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-6 w-6 rounded-md bg-[#c4a35a] shrink-0" />
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
                    ✓ Trim Range Applied ({formatSeconds(trimStart)} – {formatSeconds(trimEnd)})
                  </span>
                )}

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SopCategory)}
                  className="rounded-lg border border-white/8 bg-[#141414] px-3 py-2 text-xs text-[#f4f2ee]/70 outline-none"
                >
                  <option value="turnover">Turnovers & Cleaning</option>
                  <option value="guest_ops">Guest Comms</option>
                  <option value="software">Software & Settings</option>
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
                  {isSaving ? "Saving to Playbook..." : initialSop ? "Save Changes ✓" : "Save Video & Guide to Playbook ✓"}
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

            {/* Split Review Content */}
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
                      {/* Active played width */}
                      <div
                        style={{ width: `${(playbackTime / duration) * 100}%` }}
                        className="absolute inset-y-0 left-0 rounded-full bg-[#c4a35a]"
                      />
                      {/* Gold Scrubber Thumb */}
                      <div
                        style={{ left: `${(playbackTime / duration) * 100}%` }}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-[#dcc084] shadow-[0_0_0_4px_rgba(196,163,90,0.3)]"
                      />

                      {/* Step markers from transcript */}
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

                {/* Video Actions: Trim Recording, Re-record, Download */}
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

              {/* Right Column: Interactive Editable Voice Transcript */}
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
                          We didn't detect any spoken words. You can save this video directly to the playbook, or click below to add manual step timestamps.
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
          </div>
        )}

        {/* ======================================================== */}
        {/* FRAME 5 · DEDICATED TRIMMER VIEW                        */}
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
              {/* Preview Window in Trim Mode */}
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
                    onClick={() => {
                      setTrimStart(playbackTime);
                    }}
                    className="rounded-md bg-black/75 border border-white/10 px-3 py-1 text-xs text-[#f4f2ee]/70 hover:text-white"
                  >
                    Set Start ({formatSeconds(playbackTime)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrimEnd(playbackTime);
                    }}
                    className="rounded-md bg-black/75 border border-white/10 px-3 py-1 text-xs text-[#f4f2ee]/70 hover:text-white"
                  >
                    Set End ({formatSeconds(playbackTime)})
                  </button>
                </div>
              </div>

              {/* Gold Dual-Handle Timeline Bar */}
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

                {/* Waveform & Draggable Handle Container */}
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
                  {/* Mock Waveform Bars */}
                  <div className="absolute inset-0 flex items-center gap-[3px] px-2 opacity-40">
                    {Array.from({ length: 44 }).map((_, i) => (
                      <div
                        key={i}
                        style={{ height: `${20 + ((i * 17) % 65)}%` }}
                        className="flex-1 bg-[#444] rounded-sm"
                      />
                    ))}
                  </div>

                  {/* Left Trimmed-out Zone */}
                  <div
                    style={{ width: `${(trimStart / duration) * 100}%` }}
                    className="absolute inset-y-0 left-0 bg-black/80"
                  />

                  {/* Right Trimmed-out Zone */}
                  <div
                    style={{ width: `${((duration - trimEnd) / duration) * 100}%` }}
                    className="absolute inset-y-0 right-0 bg-black/80"
                  />

                  {/* Active Gold Highlight Border */}
                  <div
                    style={{
                      left: `${(trimStart / duration) * 100}%`,
                      width: `${((trimEnd - trimStart) / duration) * 100}%`,
                    }}
                    className="absolute inset-y-0 border-2 border-[#c4a35a] rounded-lg shadow-[0_0_0_1px_rgba(196,163,90,0.25)_inset]"
                  />

                  {/* Left Draggable Handle */}
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

                  {/* Right Draggable Handle */}
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

                  {/* Current Playhead Needle */}
                  <div
                    style={{ left: `${(playbackTime / duration) * 100}%` }}
                    className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_white]"
                  />
                </div>

                {/* Play Controls & Exact Time Badges */}
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

                  <span className="text-xs text-[#f4f2ee]/35 hidden md:inline">
                    Trimmed audio re-transcribes automatically · timestamps shift with it
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* FRAME 6 · SAVED TO PLAYBOOK CONFIRMATION                */}
        {/* ======================================================== */}
        {stage === "saved" && (
          <div className="flex-1 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-[660px] rounded-[18px] border border-[#c4a35a]/30 bg-[#141414] p-8 sm:p-10 shadow-[0_40px_120px_rgba(0,0,0,0.75)] space-y-7">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c4a35a]/50 bg-[#c4a35a]/15 text-lg font-bold text-[#dcc084]">
                  ✓
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-bold tracking-tight text-[#f4f2ee]">
                    Saved to the Playbook
                  </h3>
                  <p className="text-sm leading-relaxed text-[#f4f2ee]/50">
                    Your video and the written guide are live for the {targetRole.toUpperCase()} team. Everyone assigned has been notified.
                  </p>
                </div>
              </div>

              {/* Preview Card */}
              <div className="flex gap-4 p-4 rounded-xl border border-white/8 bg-[#0e0e0e]">
                <div className="relative flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-[#1a1a1a] border border-white/7 overflow-hidden">
                  <div className="ml-0.5 w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-[#dcc084]" />
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9.5px] text-[#f4f2ee]/70">
                    {formatSeconds(trimEnd - trimStart)}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h4 className="text-sm font-semibold text-[#f4f2ee] truncate">{title}</h4>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded bg-[#c4a35a]/15 border border-[#c4a35a]/30 px-2 py-0.5 font-semibold text-[#dcc084]">
                      {targetRole.toUpperCase()} Team
                    </span>
                    <span className="rounded bg-[#1a1a1a] border border-white/8 px-2 py-0.5 text-[#f4f2ee]/60">
                      {category === "turnover" ? "Turnovers & Cleaning" : category}
                    </span>
                    <span className="rounded bg-[#1a1a1a] border border-white/8 px-2 py-0.5 text-[#f4f2ee]/60">
                      {transcript.length > 0
                        ? `${transcript.length} steps · transcript attached`
                        : "Video walkthrough · 1 step"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-[#c4a35a] py-3.5 text-sm font-bold text-[#0a0a0a] hover:bg-[#dcc084] shadow-[0_12px_40px_rgba(196,163,90,0.3)] transition"
                >
                  View SOP in Playbook
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStage("setup");
                    setVideoBlobUrl(null);
                    setRecordingSeconds(0);
                  }}
                  className="rounded-xl border border-white/10 bg-[#0e0e0e] px-5 py-3.5 text-xs sm:text-sm font-semibold text-[#f4f2ee]/70 hover:border-[#c4a35a]/40 hover:text-[#dcc084] transition"
                >
                  Record another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
