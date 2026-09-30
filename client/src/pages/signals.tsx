import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Trash2, X, Send, Camera, Radio, Flag } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SignalProfile {
  id: string;
  name: string;
  imageUrl: string;
  age: number;
  location: string;
}

interface Signal {
  id: string;
  profileId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  createdAt: string;
  profile: SignalProfile;
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
}

interface SignalCommentItem {
  id: string;
  profileId: string;
  content: string;
  createdAt: string;
  profile: SignalProfile;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}g`;
}

function SignalMediaPlayer({ mediaUrl, mediaType }: { mediaUrl: string; mediaType: string }) {
  const src = mediaUrl;
  if (mediaType === "image") {
    return (
      <div className="mt-2 rounded-xl overflow-hidden max-h-72">
        <img src={src} alt="visione cosmica" className="w-full object-cover" loading="lazy" />
      </div>
    );
  }
  if (mediaType === "video") {
    return (
      <div className="mt-2 rounded-xl overflow-hidden">
        <video src={src} controls className="w-full max-h-72 rounded-xl" playsInline />
      </div>
    );
  }
  if (mediaType === "audio") {
    return (
      <div className="mt-2">
        <audio src={src} controls className="w-full" />
      </div>
    );
  }
  return null;
}

function CommentsModal({ signal, myProfileId, onClose }: { signal: Signal; myProfileId: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const { toast } = useToast();

  const { data: comments = [], isLoading } = useQuery<SignalCommentItem[]>({
    queryKey: ["/api/signals", signal.id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/signals/${signal.id}/comments`, { credentials: "include" });
      return res.json();
    },
  });

  const addComment = useMutation({
    mutationFn: () => apiRequest("POST", `/api/signals/${signal.id}/comments`, { content: text.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals", signal.id, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      setText("");
    },
    onError: () => toast({ title: "Errore", description: "Trasmissione interrotta", variant: "destructive" }),
  });
  const reportComment = useMutation({
    mutationFn: (comment: SignalCommentItem) => apiRequest("POST", "/api/reports", {
      reportedId: comment.profileId,
      reason: "Contenuto inappropriato",
      reportedContentType: "signal_comment",
      reportedContentId: comment.id,
    }),
    onSuccess: () => toast({ title: "Segnalazione inviata", description: "Il team di moderazione la esaminerà entro 24 ore." }),
    onError: () => toast({ title: "Errore", description: "Impossibile inviare la segnalazione", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full max-h-[75vh] bg-[#0d0120] border-t border-purple-500/30 rounded-t-3xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/10">
          <span className="text-white font-semibold">🌀 Risonanze ({comments.length})</span>
          <button onClick={onClose} data-testid="button-close-comments">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
          {isLoading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
          )}
          {!isLoading && comments.length === 0 && (
            <p className="text-white/40 text-sm text-center py-6">Nessuna risonanza ancora. Sii il primo a vibrare!</p>
          )}
          {comments.map(c => (
            <div key={c.id} id={`signal-comment-${c.id}`} className="flex items-start gap-2" data-testid={`comment-item-${c.id}`}>
              <img src={c.profile.imageUrl} alt={c.profile.name} className="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" />
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2">
                <span className="text-xs text-purple-300 font-semibold mr-2">{c.profile.name}</span>
                <span className="text-white/80 text-sm">{c.content}</span>
              </div>
              {c.profileId !== myProfileId && (
                <button
                  onClick={() => reportComment.mutate(c)}
                  disabled={reportComment.isPending}
                  className="text-white/30 hover:text-red-400 p-1"
                  aria-label="Segnala commento"
                  data-testid={`button-report-comment-${c.id}`}
                >
                  <Flag className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/10">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && text.trim() && addComment.mutate()}
            placeholder="Trasmetti la tua risonanza…"
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-white/40 outline-none border border-white/10 focus:border-purple-500/50"
            data-testid="input-signal-comment"
          />
          <button
            onClick={() => text.trim() && addComment.mutate()}
            disabled={!text.trim() || addComment.isPending}
            className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center disabled:opacity-40"
            data-testid="button-send-comment"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SignalCard({
  signal,
  myProfileId,
  onProfileClick,
}: {
  signal: Signal;
  myProfileId: string;
  onProfileClick: (id: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [localLiked, setLocalLiked] = useState(signal.hasLiked);
  const [localLikes, setLocalLikes] = useState(signal.likesCount);
  const { toast } = useToast();

  const likeMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/signals/${signal.id}/like`, {}),
    onMutate: () => {
      setLocalLiked(prev => !prev);
      setLocalLikes(prev => localLiked ? prev - 1 : prev + 1);
    },
    onSuccess: (data: any) => {
      setLocalLiked(data.liked);
      setLocalLikes(data.count);
    },
    onError: () => {
      setLocalLiked(signal.hasLiked);
      setLocalLikes(signal.likesCount);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/signals/${signal.id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/signals"] }),
    onError: () => toast({ title: "Errore", description: "Impossibile rimuovere il segnale", variant: "destructive" }),
  });
  const reportMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reports", {
      reportedId: signal.profileId,
      reason: "Contenuto inappropriato",
      reportedContentType: "cosmic_signal",
      reportedContentId: signal.id,
    }),
    onSuccess: () => toast({ title: "Segnalazione inviata", description: "Il team di moderazione la esaminerà entro 24 ore." }),
    onError: () => toast({ title: "Errore", description: "Impossibile inviare la segnalazione", variant: "destructive" }),
  });

  const isOwn = signal.profileId === myProfileId;

  const signalTypeIcon = signal.mediaType === "image" ? "🛸"
    : signal.mediaType === "video" ? "⚡"
    : signal.mediaType === "audio" ? "🎵"
    : "🌌";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 space-y-2"
        id={`signal-card-${signal.id}`}
        data-testid={`signal-card-${signal.id}`}
      >
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2"
            onClick={() => onProfileClick(signal.profileId)}
            data-testid={`button-signal-profile-${signal.id}`}
          >
            <img
              src={signal.profile.imageUrl}
              alt={signal.profile.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-purple-500/40"
            />
            <div className="text-left">
              <p className="text-white font-semibold text-sm leading-tight">{signal.profile.name}</p>
              <p className="text-white/40 text-xs">{signal.profile.location} · {timeAgo(signal.createdAt)}</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">{signalTypeIcon}</span>
            {isOwn && (
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="text-white/30 hover:text-red-400 transition-colors"
                data-testid={`button-delete-signal-${signal.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {!isOwn && (
              <button
                onClick={() => reportMut.mutate()}
                disabled={reportMut.isPending}
                className="text-white/30 hover:text-red-400 transition-colors"
                aria-label="Segnala contenuto"
                data-testid={`button-report-signal-${signal.id}`}
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {signal.content && (
          <p className="text-white/90 text-sm leading-relaxed" data-testid={`text-signal-content-${signal.id}`}>
            "{signal.content}"
          </p>
        )}

        {signal.mediaUrl && signal.mediaType && signal.mediaType !== "text" && (
          <SignalMediaPlayer mediaUrl={signal.mediaUrl} mediaType={signal.mediaType} />
        )}

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={() => likeMut.mutate()}
            className="flex items-center gap-1.5 text-sm transition-colors"
            data-testid={`button-like-signal-${signal.id}`}
          >
            <Heart
              className={`w-4 h-4 transition-all ${localLiked ? "text-purple-400 fill-purple-400 scale-110" : "text-white/50"}`}
            />
            <span className={localLiked ? "text-purple-300" : "text-white/50"}>{localLikes}</span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
            data-testid={`button-comments-signal-${signal.id}`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{signal.commentsCount}</span>
          </button>

          <span className="ml-auto text-xs text-purple-400/60">🌀 risuona</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {showComments && (
          <CommentsModal signal={signal} myProfileId={myProfileId} onClose={() => setShowComments(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

function CreateSignalSheet({ myProfile, onClose }: { myProfile: SignalProfile; onClose: () => void }) {
  const [step, setStep] = useState<"choose" | "compose">("choose");
  const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "audio">("text");
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const createMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/signals", {
      content: text.trim(),
      mediaUrl: mediaUrl || undefined,
      mediaType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      onClose();
      toast({ title: "Segnale trasmesso! 🛸", description: "La tua frequenza cosmica è nell'universo" });
    },
    onError: () => toast({ title: "Errore", description: "Trasmissione fallita, riprova", variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const urlRes = await fetch("/api/signals/request-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });
      if (!urlRes.ok) throw new Error("Canale non disponibile");
      const { uploadURL, objectPath, mediaType: detectedType } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setMediaUrl(objectPath);
      setMediaType(detectedType as "image" | "video" | "audio");
      toast({ title: "Frequenza acquisita ✓" });
    } catch {
      toast({ title: "Errore trasmissione", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const pickTypes: Array<{ type: "text" | "image" | "video" | "audio"; icon: string; label: string; sublabel: string; accept: string }> = [
    { type: "text",  icon: "🌌", label: "Pensiero Galattico", sublabel: "Trasmetti un pensiero",   accept: "" },
    { type: "image", icon: "🛸", label: "Visione Cosmica",    sublabel: "Condividi una visione",   accept: "image/*" },
    { type: "video", icon: "⚡", label: "Impulso Stellare",   sublabel: "Lancia un impulso",       accept: "video/*" },
    { type: "audio", icon: "🎵", label: "Onda Vibrazionale",  sublabel: "Emetti la tua frequenza", accept: "audio/*" },
  ];

  const placeholders: Record<string, string> = {
    text:  'Es. "Oggi la galassia vibra di energia positiva ✨"',
    image: 'Aggiungi una nota alla tua visione cosmica…',
    video: 'Descrivi il tuo impulso stellare…',
    audio: 'Descrivi la tua onda vibrazionale…',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25 }}
        className="w-full bg-[#0d0120] border-t border-purple-500/30 rounded-t-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-4" />

        {step === "choose" && (
          <div className="px-6 pb-8">
            <h2 className="text-white text-xl font-bold text-center mb-1">🛸 Scegli il tuo Segnale</h2>
            <p className="text-white/40 text-xs text-center mb-6">Quale frequenza vuoi trasmettere nell'universo?</p>
            <div className="grid grid-cols-2 gap-4">
              {pickTypes.map(pt => (
                <button
                  key={pt.type}
                  onClick={() => {
                    setMediaType(pt.type);
                    if (pt.type !== "text") {
                      setStep("compose");
                      setTimeout(() => fileRef.current?.click(), 100);
                    } else {
                      setStep("compose");
                    }
                  }}
                  className="flex flex-col items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all active:scale-95"
                  data-testid={`button-signal-type-${pt.type}`}
                >
                  <span className="text-4xl">{pt.icon}</span>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm leading-tight">{pt.label}</p>
                    <p className="text-white/40 text-xs mt-0.5">{pt.sublabel}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "compose" && (
          <div className="px-6 pb-8 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setStep("choose"); setMediaUrl(null); }} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-white text-lg font-bold flex-1 text-center">
                {mediaType === "text" ? "🌌 Pensiero Galattico" :
                  mediaType === "image" ? "🛸 Visione Cosmica" :
                  mediaType === "video" ? "⚡ Impulso Stellare" : "🎵 Onda Vibrazionale"}
              </h2>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={placeholders[mediaType] || placeholders.text}
              rows={3}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:border-purple-500/50 resize-none"
              data-testid="input-signal-text"
            />

            {mediaType !== "text" && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept={pickTypes.find(p => p.type === mediaType)?.accept || "*/*"}
                  className="hidden"
                  onChange={handleFileChange}
                />
                {!mediaUrl ? (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-4 border-2 border-dashed border-purple-500/40 rounded-xl text-white/50 text-sm hover:border-purple-500/70 hover:text-white/80 transition-all flex items-center justify-center gap-2"
                    data-testid="button-signal-pick-file"
                  >
                    {uploading ? (
                      <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        Tocca per caricare la frequenza
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                    <span className="text-green-400 text-sm flex-1">✓ Frequenza acquisita</span>
                    <button onClick={() => setMediaUrl(null)} className="text-white/40 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => createMut.mutate()}
              disabled={(!text.trim() && !mediaUrl) || createMut.isPending || uploading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-transform"
              data-testid="button-send-signal"
            >
              {createMut.isPending ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  Trasmetti nell'Universo
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ProfileSheet({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const { data: profile, isLoading } = useQuery<SignalProfile & { bio?: string; interests?: string[]; isVerified?: boolean }>({
    queryKey: ["/api/profiles", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${profileId}`, { credentials: "include" });
      return res.json();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25 }}
        className="w-full max-h-[80vh] bg-[#0d0120] border-t border-purple-500/30 rounded-t-3xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2" />
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        ) : profile ? (
          <div className="pb-8">
            <div className="relative">
              <img src={profile.imageUrl} alt={profile.name} className="w-full h-56 object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0120] via-transparent to-transparent" />
              <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="px-5 -mt-6 relative space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-white text-xl font-bold">{profile.name}, {profile.age}</h2>
                {profile.isVerified && <span className="text-blue-400 text-sm">✓</span>}
              </div>
              {profile.location && <p className="text-white/50 text-sm">📍 {profile.location}</p>}
              {profile.bio && <p className="text-white/70 text-sm leading-relaxed mt-1">{profile.bio}</p>}
              {profile.interests && profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.interests.map((i: string) => (
                    <span key={i} className="text-xs bg-purple-500/20 border border-purple-500/30 text-purple-300 px-2.5 py-1 rounded-full">{i}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-white/50 text-center py-8 text-sm">👽 Entità non rintracciata nella galassia</p>
        )}
      </motion.div>
    </div>
  );
}

export default function Signals() {
  const [showCreate, setShowCreate] = useState(false);
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);

  const { data: myProfile } = useQuery<SignalProfile>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const res = await fetch("/api/profiles/me", { credentials: "include" });
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: signalsRaw, isLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"],
    queryFn: async () => {
      const res = await fetch("/api/signals", { credentials: "include" });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 30000,
  });
  const signals = Array.isArray(signalsRaw) ? signalsRaw : [];

  useEffect(() => {
    if (!signals.length || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id.startsWith("signal-card-")) return;
    const timeout = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [signals]);

  const handleProfileClick = (profileId: string) => setViewProfileId(profileId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-purple-400" />
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Cosmic Signals</h1>
            <p className="text-white/40 text-xs">Frequenze dall'universo Vibra</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors active:scale-95"
          data-testid="button-create-signal"
        >
          <Radio className="w-3.5 h-3.5" />
          Trasmetti
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!isLoading && signals.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">📡</div>
            <p className="text-white/60 text-sm">Nessuna frequenza cosmica rilevata.</p>
            <p className="text-white/40 text-xs">Avvia la prima trasmissione nell'universo!</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 px-6 py-2.5 rounded-full bg-purple-600 text-white text-sm font-semibold"
              data-testid="button-create-signal-empty"
            >
              🛸 Avvia Trasmissione
            </button>
          </div>
        )}

        {signals.map(signal => (
          <SignalCard
            key={signal.id}
            signal={signal}
            myProfileId={myProfile?.id || ""}
            onProfileClick={handleProfileClick}
          />
        ))}
      </div>

      <AnimatePresence>
        {showCreate && myProfile && (
          <CreateSignalSheet myProfile={myProfile} onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewProfileId && (
          <ProfileSheet profileId={viewProfileId} onClose={() => setViewProfileId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
