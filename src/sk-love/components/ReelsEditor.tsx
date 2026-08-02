// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Music, Sparkles, Sticker as StickerIcon, Upload, Video, Camera, Circle, Square } from "lucide-react";

// ---------------------------------------------------------------
// 8টি Royalty-free demo music track (Pixabay / Free Music Archive)
// ---------------------------------------------------------------
export const PRESET_MUSIC = [
  { id: "m1", title: "Chill Vibes", artist: "Lofi Loop", url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_1e8f6a7bfd.mp3" },
  { id: "m2", title: "Sunny Day", artist: "Acoustic Pop", url: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946f4a3e6b.mp3" },
  { id: "m3", title: "Party Anthem", artist: "EDM Loop", url: "https://cdn.pixabay.com/download/audio/2022/08/04/audio_d0c6ff1b46.mp3" },
  { id: "m4", title: "Romantic Piano", artist: "Solo Piano", url: "https://cdn.pixabay.com/download/audio/2022/10/18/audio_31d0b1c04e.mp3" },
  { id: "m5", title: "Hip Hop Beat", artist: "Trap Loop", url: "https://cdn.pixabay.com/download/audio/2022/11/17/audio_febc508520.mp3" },
  { id: "m6", title: "Cinematic Rise", artist: "Epic Score", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
  { id: "m7", title: "Cafe Jazz", artist: "Smooth Jazz", url: "https://cdn.pixabay.com/download/audio/2022/03/09/audio_c8e0a3f0e1.mp3" },
  { id: "m8", title: "Bollywood Groove", artist: "Desi Beat", url: "https://cdn.pixabay.com/download/audio/2023/01/16/audio_2f6b1e9d1a.mp3" },
];

// CSS filter presets
const FILTERS = [
  { id: "none", label: "Original", css: "none" },
  { id: "warm", label: "Warm", css: "saturate(1.3) sepia(0.15) contrast(1.05)" },
  { id: "cool", label: "Cool", css: "saturate(1.2) hue-rotate(-15deg) contrast(1.05)" },
  { id: "vintage", label: "Vintage", css: "sepia(0.6) contrast(0.95) saturate(0.9)" },
  { id: "bw", label: "B&W", css: "grayscale(1) contrast(1.1)" },
  { id: "vivid", label: "Vivid", css: "saturate(1.7) contrast(1.15)" },
];

const STICKERS = ["❤️", "🔥", "😂", "🎉", "✨", "😍", "🥰", "💯", "👑", "💎", "🌸", "⭐"];

type Overlay = { id: number; emoji: string; x: number; y: number };

type ReelsEditorProps = {
  open: boolean;
  onClose: () => void;
  onPublish: (payload: {
    videoDataUrl: string;
    videoFile?: File;
    filterId: string;
    musicId: string | null;
    stickers: Overlay[];
    caption: string;
  }) => Promise<void> | void;
};

export default function ReelsEditor({ open, onClose, onPublish }: ReelsEditorProps) {
  const [videoDataUrl, setVideoDataUrl] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | undefined>(undefined);
  const [filterId, setFilterId] = useState("none");
  const [musicId, setMusicId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Overlay[]>([]);
  const [caption, setCaption] = useState("");
  const [tab, setTab] = useState<"filter" | "music" | "sticker">("filter");
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const activeFilter = useMemo(() => FILTERS.find((f) => f.id === filterId) || FILTERS[0], [filterId]);
  const activeMusic = useMemo(() => PRESET_MUSIC.find((m) => m.id === musicId) || null, [musicId]);

  useEffect(() => {
    if (!open) {
      if (videoDataUrl.startsWith("blob:")) URL.revokeObjectURL(videoDataUrl);
      setVideoDataUrl("");
      setVideoFile(undefined);
      setFilterId("none");
      setMusicId(null);
      setStickers([]);
      setCaption("");
      setTab("filter");
      if (audioRef.current) audioRef.current.pause();
    }
  }, [open]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (activeMusic) {
        audioRef.current.src = activeMusic.url;
        audioRef.current.loop = true;
        audioRef.current.volume = 0.6;
        void audioRef.current.play().catch(() => {});
      }
    }
  }, [activeMusic]);

  const handleFile = (file?: File) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("⚠️ Video 50MB এর নিচে হতে হবে।");
      return;
    }
    if (videoDataUrl.startsWith("blob:")) URL.revokeObjectURL(videoDataUrl);
    setVideoFile(file);
    setVideoDataUrl(URL.createObjectURL(file));
  };

  // ---- Device camera recording ----
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const liveCamRef = useRef<HTMLVideoElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [showCamera, setShowCamera] = useState(false);

  const stopCameraStream = () => {
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      recordStreamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (liveCamRef.current) {
          liveCamRef.current.srcObject = stream;
          void liveCamRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      alert(`❌ Camera access denied: ${err?.message || "Permission required"}`);
    }
  };

  const startRecording = () => {
    const stream = recordStreamRef.current;
    if (!stream) return;
    recordChunksRef.current = [];
    const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
    const mimeType = mimeCandidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => e.data.size && recordChunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "video/webm" });
      if (blob.size > 50 * 1024 * 1024) {
        alert("⚠️ Recording 50MB এর বেশি হয়ে গেছে।");
        return;
      }
      const ext = (blob.type.split("/")[1] || "webm").split(";")[0] || "webm";
      const file = new File([blob], `recorded-reel-${Date.now()}.${ext}`, { type: blob.type || "video/webm" });
      if (videoDataUrl.startsWith("blob:")) URL.revokeObjectURL(videoDataUrl);
      setVideoFile(file);
      setVideoDataUrl(URL.createObjectURL(file));
      setShowCamera(false);
      stopCameraStream();
    };
    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    setRecordSecs(0);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const closeCamera = () => {
    if (isRecording) mediaRecorderRef.current?.stop();
    stopCameraStream();
    setShowCamera(false);
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isRecording) return;
    const t = setInterval(() => {
      setRecordSecs((s) => {
        if (s >= 60) { // auto-stop at 60s
          stopRecording();
          return s;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  useEffect(() => {
    if (!open) {
      closeCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);


  const addSticker = (emoji: string) => {
    setStickers((prev) => [
      ...prev,
      { id: Date.now(), emoji, x: 30 + Math.random() * 40, y: 30 + Math.random() * 40 },
    ]);
  };

  const submit = async () => {
    if (!videoDataUrl) {
      alert("⚠️ প্রথমে একটা video select করো।");
      return;
    }
    try {
      setBusy(true);
      await onPublish({ videoDataUrl, videoFile, filterId, musicId, stickers, caption });
      onClose();
    } catch (err: any) {
      alert(`❌ Upload failed: ${err?.message || "Server error"}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-2">
      <audio ref={audioRef} />
      <div className="relative w-full max-w-md h-[92vh] bg-[#0b0914] rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-pink-400" />
            <h3 className="text-white text-xs font-black uppercase tracking-wider">Reels Studio</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center overflow-hidden">
          {videoDataUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoDataUrl}
                autoPlay
                loop
                muted={!!activeMusic}
                playsInline
                controls={false}
                style={{ filter: activeFilter.css }}
                className="max-h-full max-w-full object-contain"
              />
              {stickers.map((s) => (
                <div
                  key={s.id}
                  className="absolute text-4xl select-none cursor-move"
                  style={{ left: `${s.x}%`, top: `${s.y}%`, transform: "translate(-50%, -50%)" }}
                  onDoubleClick={() => setStickers((prev) => prev.filter((x) => x.id !== s.id))}
                >
                  {s.emoji}
                </div>
              ))}
              {activeMusic && (
                <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 flex items-center gap-1.5 text-white text-[9px] font-bold">
                  <Music className="w-3 h-3 text-pink-400" />
                  {activeMusic.title}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-pink-500 text-slate-400 hover:text-pink-400 transition w-64"
              >
                <Upload className="w-8 h-8" />
                <span className="text-xs font-black uppercase tracking-wider">Gallery থেকে Select</span>
                <span className="text-[10px] text-slate-500">MP4 / MOV — Max 50MB</span>
              </button>
              <button
                type="button"
                onClick={openCamera}
                className="flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[11px] font-black uppercase tracking-wider w-64"
              >
                <Camera className="w-4 h-4" />
                Camera দিয়ে Record
              </button>
            </div>
          )}
          {showCamera && (
            <div className="absolute inset-0 z-20 bg-black flex flex-col">
              <video ref={liveCamRef} autoPlay playsInline muted className="flex-1 min-h-0 w-full object-cover" />
              {isRecording && (
                <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-red-600/90 text-white text-[10px] font-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  REC {String(Math.floor(recordSecs / 60)).padStart(2, "0")}:{String(recordSecs % 60).padStart(2, "0")}
                </div>
              )}
              <button
                onClick={closeCamera}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="shrink-0 p-4 flex items-center justify-center gap-4 bg-black/80">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-600/40"
                  >
                    <Circle className="w-8 h-8 fill-white" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-red-600 shadow-lg"
                  >
                    <Square className="w-7 h-7 fill-red-600" />
                  </button>
                )}
              </div>
              <p className="absolute bottom-24 left-0 right-0 text-center text-[9px] text-white/70">
                Max 60 seconds • auto-stop
              </p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {/* Bottom controls */}
        {videoDataUrl && (
          <div className="shrink-0 border-t border-slate-800 bg-[#100d23]">
            {/* Tab strip */}
            <div className="flex items-center border-b border-slate-800">
              {[
                { id: "filter", label: "Filter", icon: Sparkles },
                { id: "music", label: "Music", icon: Music },
                { id: "sticker", label: "Sticker", icon: StickerIcon },
              ].map((t) => {
                const Ico = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id as any)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase ${
                      tab === t.id ? "text-pink-400 border-b-2 border-pink-500" : "text-slate-500"
                    }`}
                  >
                    <Ico className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab panels */}
            <div className="p-2 max-h-40 overflow-y-auto scrollbar-thin">
              {tab === "filter" && (
                <div className="flex gap-2 overflow-x-auto">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilterId(f.id)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-black uppercase border ${
                        filterId === f.id
                          ? "bg-pink-600 border-pink-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              {tab === "music" && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setMusicId(null)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold ${
                      !musicId ? "bg-pink-600 text-white" : "bg-slate-950 text-slate-400"
                    }`}
                  >
                    🔇 No Music
                  </button>
                  {PRESET_MUSIC.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMusicId(m.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold flex items-center justify-between ${
                        musicId === m.id ? "bg-pink-600 text-white" : "bg-slate-950 text-slate-300"
                      }`}
                    >
                      <span>🎵 {m.title}</span>
                      <span className="text-[9px] opacity-70">{m.artist}</span>
                    </button>
                  ))}
                </div>
              )}
              {tab === "sticker" && (
                <div className="grid grid-cols-6 gap-2">
                  {STICKERS.map((e) => (
                    <button
                      key={e}
                      onClick={() => addSticker(e)}
                      className="p-2 text-2xl rounded-xl bg-slate-950 hover:bg-slate-900"
                    >
                      {e}
                    </button>
                  ))}
                  <p className="col-span-6 text-[9px] text-slate-500 text-center pt-1">
                    Sticker যোগ করতে ক্লিক করো • Preview-এ double-click করে remove করো
                  </p>
                </div>
              )}
            </div>

            {/* Caption + Publish */}
            <div className="p-2 border-t border-slate-800 flex items-center gap-2">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption লিখো..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-white outline-none placeholder:text-slate-600"
              />
              <button
                onClick={submit}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                {busy ? "..." : "Publish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
