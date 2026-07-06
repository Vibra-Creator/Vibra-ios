import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Heart, VolumeX, Volume2, User, MapPin,
  BadgeCheck, ChevronDown, ChevronUp, Film,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useGuest } from "@/hooks/use-guest";
import { useToast } from "@/hooks/use-toast";

interface FeedVideo {
  id: string;
  name: string;
  age: number;
  location?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  profileVideoUrl: string;
  isVerified?: boolean | null;
  isBot?: boolean | null;
  gender?: string | null;
  interests?: string[] | null;
}

function resolveVideoUrl(url: string): string {
  if (url.startsWith("/objects/")) {
    return `/api/video-stream-object?path=${encodeURIComponent(url)}`;
  }
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return `/api/video-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function isTikTokUrl(url: string): boolean {
  return url.includes("tiktok.com");
}

function getTikTokEmbedUrl(url: string): string | null {
  const match = url.match(/video\/(\d+)/);
  if (match) return `https://www.tiktok.com/embed/v2/${match[1]}`;
  return null;
}

// ─── Single Reel Item ────────────────────────────────────────────────────────

interface VideoItemProps {
  profile: FeedVideo;
  index: number;
  isActive: boolean;
  isNear: boolean;
  muted: boolean;
  isLiked: boolean;
  onLike: (id: string) => void;
  onOpenProfile: (profile: FeedVideo) => void;
  itemRef: (el: HTMLDivElement | null) => void;
}

const VideoItem = memo(function VideoItem({
  profile,
  index,
  isActive,
  isNear,
  muted,
  isLiked,
  onLike,
  onOpenProfile,
  itemRef,
}: VideoItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showBio, setShowBio] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [videoPaused, setVideoPaused] = useState(true);

  // Sync muted state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => {
      setIsBuffering(false);
      // Se il video è quello attivo ma non sta girando, fallo partire
      if (video.paused && isActive) {
        video.muted = muted;
        video.play().catch(() => {});
      }
    };
    const onPlay = () => setVideoPaused(false);
    const onPause = () => setVideoPaused(true);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  // Force play/pause when isActive changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolveVideoUrl) return;
    if (isActive) {
      video.muted = muted;
      video.currentTime = 0;
      const p = video.play();
      if (p) p.catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive, muted]);

  // Only provide src for nearby videos to save RAM
  const resolvedSrc = isNear ? resolveVideoUrl(profile.profileVideoUrl) : undefined;
  const preloadStrategy: "auto" | "metadata" | "none" =
    isActive ? "auto" : isNear ? "metadata" : "none";

  const handleTapVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  return (
    <div
      ref={itemRef}
      data-index={index}
      className="snap-start snap-always relative flex-shrink-0 overflow-hidden bg-black"
      style={{ height: "100%" }}
    >
      {/* Video layer */}
      {isTikTokUrl(profile.profileVideoUrl) ? (
        <div className="absolute inset-0 w-full h-full bg-black flex flex-col">
          {getTikTokEmbedUrl(profile.profileVideoUrl) ? (
            <iframe
              src={getTikTokEmbedUrl(profile.profileVideoUrl)!}
              className="w-full flex-1 border-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={`TikTok di ${profile.name}`}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
              <span className="text-5xl">🎵</span>
              <p className="text-white font-semibold text-center">{profile.name} ha un video TikTok</p>
              <a href={profile.profileVideoUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background:"linear-gradient(135deg,#010101,#69C9D0)" }}>
                🎵 Apri su TikTok
              </a>
            </div>
          )}
        </div>
      ) : (
        <video
          ref={videoRef}
          src={resolvedSrc}
          poster={profile.imageUrl || undefined}
          loop
          muted
          playsInline
          autoPlay={isActive}
          preload={preloadStrategy}
          onClick={handleTapVideo}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
          style={{
            transform: "translateZ(0)",
            willChange: "transform",
            backgroundColor: "#000",
          }}
        />
      )}

      {/* Pause indicator / tap-to-play */}
      {videoPaused && isActive && !isBuffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 gap-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3 }}
            className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center border border-white/20"
          >
            <div
              className="w-0 h-0 ml-1"
              style={{
                borderTop: "10px solid transparent",
                borderBottom: "10px solid transparent",
                borderLeft: "18px solid white",
              }}
            />
          </motion.div>
          <span className="text-white/80 text-xs font-medium bg-black/40 px-3 py-1 rounded-full">
            Tocca per riprodurre
          </span>
        </div>
      )}

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 25%, transparent 55%)",
        }}
      />

      {/* Top gradient overlay (for readability of top controls) */}
      <div
        className="absolute top-0 left-0 right-0 h-24 pointer-events-none z-10"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
        }}
      />

      {/* ── Right sidebar actions ── */}
      <div className="absolute right-3 z-20 flex flex-col items-center gap-5"
        style={{ bottom: "max(96px, calc(96px + env(safe-area-inset-bottom)))" }}>

        {/* Like / Vibe button */}
        <button
          onClick={() => onLike(profile.id)}
          className="flex flex-col items-center gap-1"
          data-testid={`button-reel-like-${profile.id}`}
        >
          <motion.div
            whileTap={{ scale: 0.82 }}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors duration-200 ${
              isLiked
                ? "bg-gradient-to-br from-pink-500 to-rose-600"
                : "bg-black/60 backdrop-blur-sm border border-white/20"
            }`}
          >
            <Heart
              className={`w-6 h-6 transition-all duration-200 ${
                isLiked ? "fill-white text-white scale-110" : "text-white"
              }`}
            />
          </motion.div>
          <span className="text-white text-[11px] font-bold drop-shadow-lg">
            {isLiked ? "Vibrato!" : "Vibe"}
          </span>
        </button>

        {/* Profile avatar button */}
        <button
          onClick={() => onOpenProfile(profile)}
          className="flex flex-col items-center gap-1"
          data-testid={`button-reel-profile-${profile.id}`}
        >
          <div
            className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-lg"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            {profile.imageUrl ? (
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          <span className="text-white text-[11px] font-bold drop-shadow-lg">Profilo</span>
        </button>
      </div>

      {/* ── Bottom profile info ── */}
      <div
        className="absolute left-3 right-16 z-20"
        style={{ bottom: "max(80px, calc(80px + env(safe-area-inset-bottom)))" }}
      >
        {/* Name + verification */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-white font-bold text-lg drop-shadow-lg leading-tight">
            {profile.name}, {profile.age}
          </span>
          {profile.isVerified && (
            <BadgeCheck className="w-5 h-5 text-cyan-400 shrink-0" style={{ filter: "drop-shadow(0 0 4px #67e8f9)" }} />
          )}
          {profile.isBot && (
            <span className="text-[10px] bg-purple-500/80 text-white px-1.5 py-0.5 rounded-full font-semibold">BOT</span>
          )}
        </div>

        {/* Location */}
        {profile.location && (
          <div className="flex items-center gap-1 mb-1.5">
            <MapPin className="w-3 h-3 text-white/70 shrink-0" />
            <span className="text-white/70 text-xs truncate">{profile.location}</span>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div>
            <p
              className={`text-white/90 text-sm leading-snug drop-shadow ${
                showBio ? "" : "line-clamp-2"
              }`}
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
            >
              {profile.bio}
            </p>
            {profile.bio.length > 70 && (
              <button
                onClick={() => setShowBio(s => !s)}
                className="text-white/60 text-xs mt-0.5 flex items-center gap-0.5 active:text-white"
              >
                {showBio ? (
                  <><ChevronUp className="w-3 h-3" /> meno</>
                ) : (
                  <><ChevronDown className="w-3 h-3" /> altro</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Interests pills */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {profile.interests.slice(0, 3).map((interest) => (
              <span
                key={interest}
                className="text-[10px] bg-white/15 backdrop-blur-sm text-white px-2 py-0.5 rounded-full border border-white/20"
              >
                {interest}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar (thin, at very bottom) */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          />
        </div>
      )}
    </div>
  );
});

// ─── Main Reels Page ─────────────────────────────────────────────────────────

export default function Reels() {
  const [, setLocation] = useLocation();
  const { isGuest } = useGuest();
  const { toast } = useToast();

  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Fetch page of videos ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["/api/feed/videos", page],
    queryFn: () =>
      fetch(`/api/feed/videos?page=${page}&limit=15`, { credentials: "include" }).then(r =>
        r.json()
      ),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data?.profiles) return;
    setVideos(prev => {
      if (page === 0) return data.profiles;
      const existingIds = new Set(prev.map((p: FeedVideo) => p.id));
      const fresh = data.profiles.filter((p: FeedVideo) => !existingIds.has(p.id));
      return [...prev, ...fresh];
    });
    setHasMore(data.hasMore ?? false);
    setIsFetchingMore(false);
  }, [data, page]);

  // ── IntersectionObserver for autoplay / pause ──────────────────────────────
  useEffect(() => {
    if (!videos.length) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const video = entry.target.querySelector("video") as HTMLVideoElement | null;
          if (!video) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            video.muted = muted;
            video.play().catch(() => {});
            const idx = parseInt(entry.target.getAttribute("data-index") || "0");
            setCurrentIndex(idx);
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.6 }
    );

    const refs = itemRefs.current.filter(Boolean);
    refs.forEach(el => el && observer.observe(el));

    return () => observer.disconnect();
  }, [videos.length, muted]);

  // ── Infinite scroll trigger ────────────────────────────────────────────────
  useEffect(() => {
    if (hasMore && !isFetchingMore && videos.length > 0 && currentIndex >= videos.length - 4) {
      setIsFetchingMore(true);
      setPage(p => p + 1);
    }
  }, [currentIndex, videos.length, hasMore, isFetchingMore]);

  // ── Like / Swipe ───────────────────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: (profileId: string) =>
      apiRequest("POST", "/api/swipes", { profileId, liked: true }),
    onSuccess: (_, profileId) => {
      setLiked(prev => {
        const next = new Set(prev);
        next.add(profileId);
        return next;
      });
      toast({
        title: "❤️ Vibe inviato!",
        description: "Hai messo un like a questo profilo",
        duration: 2000,
      });
    },
    onError: () => {
      toast({ title: "Errore", description: "Non ho potuto salvare il like", variant: "destructive" });
    },
  });

  const handleLike = useCallback(
    (profileId: string) => {
      if (isGuest) {
        toast({ title: "Registrati per mettere like!", variant: "destructive" });
        return;
      }
      if (!liked.has(profileId)) {
        likeMutation.mutate(profileId);
      }
    },
    [isGuest, liked, likeMutation, toast]
  );

  const handleOpenProfile = useCallback(
    (profile: FeedVideo) => {
      setLocation(`/p/${profile.id}`);
    },
    [setLocation]
  );

  const toggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m;
      // Immediately apply to the current video
      const currentItem = itemRefs.current[currentIndex];
      if (currentItem) {
        const video = currentItem.querySelector("video") as HTMLVideoElement | null;
        if (video) {
          video.muted = next;
          if (!next) video.volume = 1;
        }
      }
      return next;
    });
  }, [currentIndex]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: "pan-y" }}>

      {/* ── Top bar ── */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setLocation("/")}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/15"
          data-testid="button-reels-back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </motion.button>

        <div className="flex items-center gap-1.5">
          <Film className="w-4 h-4 text-violet-300" />
          <span
            className="font-bold text-sm tracking-wide"
            style={{
              background: "linear-gradient(90deg, #c084fc, #67e8f9, #f472b6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Vibe Feed
          </span>
          {videos.length > 0 && (
            <span className="text-white/40 text-xs ml-1">
              {currentIndex + 1}/{videos.length}
            </span>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/15"
          data-testid="button-reels-mute"
        >
          {muted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-cyan-300" />
          )}
        </motion.button>
      </div>

      {/* ── States ── */}
      {isLoading && videos.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-white/50 text-sm">Caricamento video…</p>
        </div>
      )}

      {!isLoading && videos.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="text-6xl">🛸</span>
          <p className="text-white font-bold text-xl">Nessun video disponibile</p>
          <p className="text-white/50 text-sm">
            I profili con video appariranno qui. Carica il tuo video nel profilo!
          </p>
          <button
            onClick={() => setLocation("/")}
            className="mt-2 text-cyan-400 text-sm underline underline-offset-2"
          >
            ← Torna alla home
          </button>
        </div>
      )}

      {/* ── Feed container with CSS scroll-snap ── */}
      {videos.length > 0 && (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorY: "contain",
          }}
          data-testid="reels-feed-container"
        >
          <style>{`.snap-container::-webkit-scrollbar { display: none; }`}</style>

          {videos.map((profile, index) => {
            const distance = Math.abs(index - currentIndex);
            return (
              <VideoItem
                key={profile.id}
                profile={profile}
                index={index}
                isActive={index === currentIndex}
                isNear={distance <= 2}
                muted={muted}
                isLiked={liked.has(profile.id)}
                onLike={handleLike}
                onOpenProfile={handleOpenProfile}
                itemRef={el => {
                  itemRefs.current[index] = el;
                }}
              />
            );
          })}

          {/* Loading more spinner */}
          {isFetchingMore && (
            <div
              className="snap-start snap-always flex-shrink-0 flex flex-col items-center justify-center gap-3"
              style={{ height: "100%" }}
            >
              <div className="w-10 h-10 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
              <p className="text-white/50 text-xs">Carico altri video…</p>
            </div>
          )}

          {/* End of feed */}
          {!hasMore && !isFetchingMore && videos.length > 0 && (
            <div
              className="snap-start snap-always flex-shrink-0 flex flex-col items-center justify-center gap-4"
              style={{ height: "100%" }}
            >
              <span className="text-5xl">🌌</span>
              <p className="text-white/70 font-bold text-lg">Hai visto tutto!</p>
              <p className="text-white/40 text-sm">Torna domani per nuovi video</p>
              <button
                onClick={() => {
                  setPage(0);
                  setCurrentIndex(0);
                  containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="mt-2 px-4 py-2 rounded-full bg-violet-600/80 text-white text-sm font-semibold"
                data-testid="button-reels-restart"
              >
                🔄 Ricomincia
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
