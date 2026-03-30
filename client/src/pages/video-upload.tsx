import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, MapPin, Type, Sparkles, X, Check, Video, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const MAX_VIDEO_DURATION = 12;
const MAX_SIZE_MB = 50;

const CURATED_GIFS = [
  { url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", label: "❤️ Amore" },
  { url: "https://media.giphy.com/media/26FPy3QZQqGtDcrja/giphy.gif", label: "🔥 Fuoco" },
  { url: "https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif", label: "🎉 Party" },
  { url: "https://media.giphy.com/media/TdfyKrN7HGTIY/giphy.gif", label: "😂 LOL" },
  { url: "https://media.giphy.com/media/3o6MbsgbTRHedMFBHy/giphy.gif", label: "😮 OMG" },
  { url: "https://media.giphy.com/media/3og0Iwmv38WmJBrYvS/giphy.gif", label: "👍 Top" },
  { url: "https://media.giphy.com/media/26BRuo6sJ7z1T3iO8/giphy.gif", label: "✨ Stelle" },
  { url: "https://media.giphy.com/media/26gJytsW5MAhXDSyY/giphy.gif", label: "🎊 Confetti" },
  { url: "https://media.giphy.com/media/3oEjHVm5GVpTW7OIjm/giphy.gif", label: "💃 Ballo" },
  { url: "https://media.giphy.com/media/xT9IgDEI1iZyb2wqo8/giphy.gif", label: "🛸 Alieno" },
  { url: "https://media.giphy.com/media/l0MYGb1fMem3f68Fe/giphy.gif", label: "🌈 Arcobaleno" },
  { url: "https://media.giphy.com/media/jTSodmFUMjQJQJFhW/giphy.gif", label: "🥳 Festeggia" },
  { url: "https://media.giphy.com/media/l3q2LH45XElELhjAk/giphy.gif", label: "😍 Innamorato" },
  { url: "https://media.giphy.com/media/26ufcVAp3AiqJZ96c/giphy.gif", label: "🌟 Stelle" },
  { url: "https://media.giphy.com/media/d31vTpVi1LAaLZKU/giphy.gif", label: "🙌 Applauso" },
  { url: "https://media.giphy.com/media/l0MYdVZkXp0fQpSFy/giphy.gif", label: "🏆 Vittoria" },
];

export default function VideoUpload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocationText] = useState("");
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"caption" | "location" | "gif">("caption");
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<"pick" | "compose">("pick");

  const { data: myProfile } = useQuery<any>({ queryKey: ["/api/profiles/me"] });

  const checkDuration = (file: File): Promise<number> => new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    v.src = url;
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => reject(new Error("duration check"));
  });

  const extractThumbnail = (file: File): Promise<string> => new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    let done = false;
    const timeout = setTimeout(() => { if (!done) { done = true; URL.revokeObjectURL(url); resolve(""); } }, 5000);
    const capture = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320; canvas.height = 240;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        URL.revokeObjectURL(url);
        resolve(base64 || "");
      } catch { URL.revokeObjectURL(url); resolve(""); }
    };
    video.addEventListener("seeked", capture);
    video.addEventListener("loadeddata", () => { video.currentTime = 0.001; });
    video.addEventListener("loadedmetadata", () => { video.currentTime = 0.001; });
    video.addEventListener("error", () => { if (!done) { done = true; clearTimeout(timeout); URL.revokeObjectURL(url); resolve(""); } });
    video.src = url;
  });

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    (e.target as HTMLInputElement).value = "";

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: "Video troppo grande", description: `Max ${MAX_SIZE_MB}MB`, variant: "destructive" });
      return;
    }

    try {
      const duration = await checkDuration(file);
      if (duration > MAX_VIDEO_DURATION) {
        toast({ title: "Video troppo lungo", description: `Max ${MAX_VIDEO_DURATION} secondi`, variant: "destructive" });
        return;
      }
    } catch {}

    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreviewUrl(url);
    setStep("compose");
  }, [videoPreviewUrl, toast]);

  const handlePublish = async () => {
    if (!videoFile || !myProfile) return;
    setIsUploading(true);
    try {
      const uploadRes = await apiRequest("POST", "/api/profiles/videos/request-upload", {
        contentType: videoFile.type,
        size: videoFile.size,
      }) as { uploadURL: string; objectPath: string };
      const { uploadURL, objectPath } = uploadRes;

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: videoFile,
        headers: { "Content-Type": videoFile.type },
      });
      if (!putRes.ok) throw new Error("Upload fallito");

      let thumbnailBase64 = "";
      try { thumbnailBase64 = await extractThumbnail(videoFile); } catch {}

      await apiRequest("POST", "/api/profiles/videos", {
        objectPath,
        thumbnailBase64,
        caption: caption.trim() || null,
        location: location.trim() || null,
        gifOverlayUrl: selectedGif || null,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/profiles", myProfile.id, "videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-profile"] });
      toast({ title: "Video pubblicato! 🎉", description: "Il tuo video è ora visibile nel profilo." });
      setLocation("/profile");
    } catch (err: any) {
      const msg = err?.message || "";
      let body: any = {};
      try { const i = msg.indexOf("{"); if (i !== -1) body = JSON.parse(msg.slice(i)); } catch {}
      if (body?.error === "rejected") {
        toast({ title: "Contenuto non approvato", description: "Il video non è stato approvato dalla moderazione.", variant: "destructive" });
      } else if (body?.error === "max_videos") {
        toast({ title: "Limite raggiunto", description: "Hai già 4 video. Caricandone uno nuovo, il più vecchio verrà eliminato automaticamente.", variant: "destructive" });
      } else {
        toast({ title: "Errore", description: "Impossibile pubblicare il video.", variant: "destructive" });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80 border-b border-white/10 shrink-0">
        <button
          onClick={() => { if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl); setLocation("/profile"); }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          data-testid="button-back-video-upload"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-bold text-lg flex-1">
          {step === "pick" ? "Scegli video" : "Personalizza"}
        </h1>
        {step === "compose" && videoFile && (
          <Button
            onClick={handlePublish}
            disabled={isUploading}
            className="bg-gradient-to-r from-cyan-500 to-primary text-white font-bold px-5 h-9 text-sm"
            data-testid="button-publish-video"
          >
            {isUploading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Caricamento...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                Pubblica
              </span>
            )}
          </Button>
        )}
      </div>

      {step === "pick" ? (
        /* ── STEP 1: Pick video ── */
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="w-24 h-24 rounded-full bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center">
            <Video className="w-12 h-12 text-cyan-400" />
          </div>
          <div className="text-center">
            <h2 className="text-white text-xl font-bold mb-2">Carica il tuo video</h2>
            <p className="text-white/50 text-sm">Max {MAX_VIDEO_DURATION} secondi · {MAX_SIZE_MB}MB</p>
            <p className="text-white/40 text-xs mt-1">Formati: MP4, WebM, MOV</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-xs bg-gradient-to-r from-cyan-500 to-primary text-white font-bold py-4 rounded-2xl text-lg flex items-center justify-center gap-3 active:scale-95 transition-transform"
            data-testid="button-pick-video"
          >
            <Upload className="w-6 h-6" />
            Scegli dalla galleria
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/mov"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-video-file"
          />
        </div>
      ) : (
        /* ── STEP 2: Compose ── */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Video preview with overlays */}
          <div className="relative w-full bg-black" style={{ aspectRatio: "9/16", maxHeight: "55vh" }}>
            {videoPreviewUrl && (
              <video
                src={videoPreviewUrl}
                className="absolute inset-0 w-full h-full object-contain"
                autoPlay
                loop
                muted
                playsInline
              />
            )}

            {/* Location overlay — top left */}
            {location && (
              <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/70 rounded-full px-2.5 py-1 max-w-[60%]">
                <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="text-white text-[11px] font-medium truncate">{location}</span>
              </div>
            )}

            {/* GIF overlay — center top area */}
            {selectedGif && (
              <div className="absolute top-8 right-3 pointer-events-none">
                <img src={selectedGif} alt="gif" className="w-20 h-20 object-contain rounded-xl" />
              </div>
            )}

            {/* Caption overlay — bottom */}
            {caption && (
              <div className="absolute bottom-3 left-0 right-0 px-3">
                <div className="bg-black/70 rounded-xl px-3 py-2">
                  <p className="text-white text-sm font-medium text-center leading-snug">{caption}</p>
                </div>
              </div>
            )}

            {/* Change video button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/70 border border-white/30 flex items-center justify-center"
              data-testid="button-change-video"
            >
              <Play className="w-4 h-4 text-white fill-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/mov"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-video-file-change"
            />
          </div>

          {/* Tools tabs */}
          <div className="shrink-0 flex border-b border-white/10 bg-[#0a0a1a]">
            {[
              { key: "caption", icon: <Type className="w-4 h-4" />, label: "Testo" },
              { key: "location", icon: <MapPin className="w-4 h-4" />, label: "Luogo" },
              { key: "gif", icon: <Sparkles className="w-4 h-4" />, label: "GIF" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold transition-colors ${
                  activeTab === tab.key
                    ? "text-cyan-400 border-b-2 border-cyan-400"
                    : "text-white/40 hover:text-white/70"
                }`}
                data-testid={`tab-${tab.key}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-[#0a0a1a]">
            <AnimatePresence mode="wait">
              {activeTab === "caption" && (
                <motion.div
                  key="caption"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="p-4 space-y-2"
                >
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Aggiungi testo</p>
                  <Input
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Scrivi qualcosa di interessante..."
                    maxLength={80}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    data-testid="input-video-caption"
                  />
                  <p className="text-white/30 text-xs text-right">{caption.length}/80</p>
                  <p className="text-white/40 text-[11px]">Il testo apparirà in overlay nella parte bassa del video.</p>
                </motion.div>
              )}

              {activeTab === "location" && (
                <motion.div
                  key="location"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="p-4 space-y-2"
                >
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Luogo ripresa</p>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                    <Input
                      value={location}
                      onChange={e => setLocationText(e.target.value)}
                      placeholder="es. Roma, Via del Corso..."
                      maxLength={50}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pl-10"
                      data-testid="input-video-location"
                    />
                  </div>
                  <p className="text-white/30 text-xs text-right">{location.length}/50</p>
                  <p className="text-white/40 text-[11px]">Il luogo apparirà in overlay in alto a sinistra del video.</p>
                </motion.div>
              )}

              {activeTab === "gif" && (
                <motion.div
                  key="gif"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="p-4"
                >
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Scegli GIF sticker</p>
                  {selectedGif && (
                    <button
                      onClick={() => setSelectedGif(null)}
                      className="mb-3 flex items-center gap-2 text-red-400 hover:text-red-300 text-xs font-semibold"
                      data-testid="button-remove-gif"
                    >
                      <X className="w-3.5 h-3.5" />
                      Rimuovi GIF
                    </button>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {CURATED_GIFS.map((gif, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedGif(selectedGif === gif.url ? null : gif.url)}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedGif === gif.url
                            ? "border-cyan-400 ring-2 ring-cyan-400/50"
                            : "border-white/10 hover:border-white/30"
                        }`}
                        data-testid={`gif-option-${i}`}
                      >
                        <img
                          src={gif.url}
                          alt={gif.label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {selectedGif === gif.url && (
                          <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white drop-shadow-lg" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
