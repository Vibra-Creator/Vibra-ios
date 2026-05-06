import { useState, forwardRef, useRef, useEffect, useCallback } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { Heart, X, Star, MapPin, Sparkles, BadgeCheck, ChevronDown, ArrowLeft, User, Ruler, GraduationCap, MessageCircle, Briefcase, Lock, Flag, Eye, ChevronLeft, ChevronRight, ZoomIn, Crown, Play, Bookmark, Share2, Volume2, VolumeX, Radio, Mic, MicOff, Square, RotateCcw, Plus } from "lucide-react";
import { StoryViewer } from "@/components/StoriesBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLocation } from "wouter";
import type { Profile, ProfileVideo } from "@shared/schema";

const SIGNAL_OPTIONS = [
  { icon: "☕", title: "Caffè?", description: "Mi piacerebbe prendere un caffè con te." },
  { icon: "🛍️", title: "Shopping?", description: "Vorrei fare shopping insieme a te." },
  { icon: "🍸", title: "Aperitivo?", description: "Ti andrebbe un aperitivo in relax?" },
  { icon: "🚶", title: "Passeggiata?", description: "Mi piacerebbe fare due passi con te." },
  { icon: "🎬", title: "Cine-serata?", description: "Mi piacerebbe una serata cinema con te." },
];

function getActivityStatus(lastActiveAt: string | Date | null | undefined, t: (key: string) => string): { label: string; color: string; isOnline: boolean } {
  if (!lastActiveAt) return { label: "", color: "", isOnline: false };
  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 5) return { label: t("swipe.activeNow"), color: "bg-green-500", isOnline: true };
  if (diffMin < 60) return { label: `${diffMin} ${t("swipe.minAgo")}`, color: "bg-green-400", isOnline: true };
  if (diffHours < 2) return { label: t("swipe.hourAgo"), color: "bg-yellow-400", isOnline: false };
  if (diffHours < 6) return { label: `${diffHours} ${t("swipe.hoursAgo")}`, color: "bg-yellow-500", isOnline: false };
  if (diffHours < 24) return { label: `${diffHours} ${t("swipe.hoursAgo")}`, color: "bg-orange-400", isOnline: false };
  if (diffDays < 3) return { label: `${diffDays}${t("swipe.daysAgo")}`, color: "bg-orange-500", isOnline: false };
  return { label: "", color: "", isOnline: false };
}

interface ProfileDetailModalProps {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
  hasPrivateRoom?: boolean;
}

export function ProfileDetailModal({ profile, isOpen, onClose, hasPrivateRoom = false }: ProfileDetailModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);

  const { data: profileVideos = [] } = useQuery<ProfileVideo[]>({
    queryKey: ['/api/profiles', profile.id, 'videos'],
    enabled: isOpen,
  });

  interface ProfileSignal { id: string; content: string | null; mediaUrl: string | null; mediaType: string | null; createdAt: string; }
  const { data: profileSignals = [] } = useQuery<ProfileSignal[]>({
    queryKey: ['/api/signals/profile', profile.id],
    queryFn: async () => {
      const res = await fetch(`/api/signals/profile/${profile.id}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: isOpen,
    staleTime: 30000,
  });
  const { data: compatibilityData } = useQuery({
    queryKey: ['/api/profiles', profile.id, 'compatibility'],
    queryFn: async () => {
      const res = await fetch(`/api/profiles/${profile.id}/compatibility`, { credentials: "include" });
      return res.ok ? res.json() : null;
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const reportMutation = useMutation({
    mutationFn: (data: { reportedId: string; reason: string }) =>
      apiRequest("POST", "/api/reports", data),
    onSuccess: () => {
      toast({ title: t("swipe.reportSent"), description: t("swipe.reportSentDesc") });
      setShowReportMenu(false);
    },
    onError: () => {
      toast({ title: t("common.error"), description: t("swipe.reportError"), variant: "destructive" });
    },
  });

  const reportReasons = [
    { key: "swipe.inappropriate", value: t("swipe.inappropriate") },
    { key: "swipe.fakeProfile", value: t("swipe.fakeProfile") },
    { key: "swipe.harassment", value: t("swipe.harassment") },
    { key: "swipe.spam", value: t("swipe.spam") },
    { key: "swipe.other", value: t("swipe.other") },
  ];

  if (!isOpen) return null;

    const allPhotos = Array.from(new Set([profile.imageUrl, ...(profile.photos || [])].filter(Boolean))) as string[];

  const detailItems = [
    { label: t("swipe.alienType"), value: profile.alienType, icon: Sparkles },
    { label: t("swipe.gender"), value: profile.gender, icon: User },
    { label: t("swipe.height"), value: profile.height ? `${profile.height} cm` : null, icon: Ruler },
    { label: t("swipe.education"), value: profile.education, icon: GraduationCap },
    { label: t("swipe.lifestyle"), value: profile.lifestyle, icon: Briefcase },
    { label: t("swipe.communication"), value: profile.communicationStyle ? profile.communicationStyle.split(",").join(", ") : null, icon: MessageCircle },
  ].filter(item => item.value);

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center"
          onClick={onClose}
          data-testid="profile-detail-overlay"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-t-2xl overflow-y-auto overscroll-contain"
            style={{ maxHeight: "90dvh", WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            onClick={(e) => e.stopPropagation()}
            data-testid="profile-detail-modal"
          >
            <div className="relative shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onClose(); }}>
              {/* Sempre foto statica nel dettaglio */}
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-full aspect-[3/4] object-cover object-top"
                data-testid="detail-profile-image"
              />
              {/* Se ha un video, mostra il bottone Play per tornare al video */}
              {profile.profileVideoUrl && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="absolute top-3 left-3 z-10 w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
                  data-testid="button-modal-back-to-video"
                >
                  <Play className="w-6 h-6 text-white fill-white" />
                </button>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              {allPhotos.length > 1 && (
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 pointer-events-none">
                  <ZoomIn className="w-3.5 h-3.5 text-white/80" />
                  <span className="text-xs text-white/80">{allPhotos.length}</span>
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-3xl font-bold text-white" data-testid="detail-profile-name">
                    {profile.name}, {profile.age}
                  </h2>
                  {profile.isVerified && (
                    <BadgeCheck className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1 text-white/80">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{profile.location}</span>
                  </div>
                  {(profile as any).distanceKm !== undefined && (
                    <div className="flex items-center gap-1 bg-cyan-500/20 px-2 py-0.5 rounded-full" data-testid="distance-badge">
                      <MapPin className="w-3 h-3 text-cyan-300 inline mr-0.5" /><span className="text-xs text-cyan-300 font-medium">{(profile as any).distanceKm} km</span>
                    </div>
                  )}
                  {(() => {
                    const activity = getActivityStatus((profile as any).lastActiveAt, t);
                    if (!activity.label) return null;
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${activity.color} ${activity.isOnline ? 'animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]' : ''}`} />
                        <span className="text-xs text-white/70 font-medium">{activity.label}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="bg-black/90 backdrop-blur-xl p-6 space-y-5 pb-44">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-primary/80 text-primary-foreground">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {profile.alienType}
                </Badge>
                {compatibilityData && (
                  <Badge variant="secondary" className="bg-gradient-to-r from-pink-500/80 to-purple-500/80 text-white" data-testid={`detail-badge-compatibility-${profile.id}`}>
                    <Heart className="w-3 h-3 mr-1" />
                    {compatibilityData.score}%
                  </Badge>
                )}
                {hasPrivateRoom && (
                  <Badge variant="secondary" className="bg-amber-500/80 text-white" data-testid={`detail-badge-private-room-${profile.id}`}>
                    <Lock className="w-3 h-3 mr-1" />
                    {t("swipe.hasVipRoom")}
                  </Badge>
                )}
              </div>

              {profile.bio && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-2">{t("swipe.bio")}</h3>
                  <p className="text-white/90 text-sm leading-relaxed" data-testid="detail-profile-bio">{profile.bio}</p>
                </div>
              )}

              {profileSignals.length > 0 && (
                <div data-testid="detail-profile-signals">
                  <h3 className="text-sm font-semibold text-white/60 mb-2 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-purple-400" />
                    Cosmic Signals
                  </h3>
                  <div className="space-y-2">
                    {profileSignals.map(sig => (
                      <div key={sig.id} className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2.5" data-testid={`detail-signal-${sig.id}`}>
                        {sig.content && (
                          <p className="text-white/85 text-sm leading-relaxed">"{sig.content}"</p>
                        )}
                        {sig.mediaUrl && sig.mediaType === "image" && (
                          <img src={sig.mediaUrl} alt="signal" className="mt-2 w-full rounded-lg object-cover max-h-48" />
                        )}
                        {sig.mediaUrl && sig.mediaType === "video" && (
                          <video src={sig.mediaUrl} controls playsInline className="mt-2 w-full rounded-lg max-h-48 bg-black" />
                        )}
                        {sig.mediaUrl && sig.mediaType === "audio" && (
                          <audio src={sig.mediaUrl} controls className="mt-2 w-full" />
                        )}
                        <p className="text-purple-400/50 text-[10px] mt-1.5">
                          {(() => { const diff = Date.now() - new Date(sig.createdAt).getTime(); const m = Math.floor(diff/60000); if(m<60) return `${m}m fa`; const h = Math.floor(m/60); if(h<24) return `${h}h fa`; return `${Math.floor(h/24)}g fa`; })()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailItems.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {detailItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 p-2 rounded-lg bg-white/5" data-testid={`detail-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">{item.label}</div>
                        <div className="text-xs text-white/90 truncate">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-2">{t("swipe.interests")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="bg-white/10 border-white/30 text-white"
                      >
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.photos && profile.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-2">{t("swipe.photos")}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {profile.photos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="aspect-square rounded-lg overflow-hidden border border-white/10 relative cursor-pointer group"
                        onClick={() => setViewingPhotoIndex(idx + 1)}
                        data-testid={`detail-photo-${idx}`}
                      >
                        <img src={photo} alt={`${t("swipe.photos")} ${idx + 1}`} className="w-full h-full object-cover object-top" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profileVideos.length > 0 && (
                <div data-testid="profile-detail-videos">
                  <h3 className="text-sm font-semibold text-white/60 mb-2">{t("profile.profileVideos")}</h3>
                  <div className="space-y-3">
                    {profileVideos.map((video, idx) => (
                      <div key={video.id} className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
                        <video
                          src={`/api/video-stream/${video.id}`}
                          controls
                          playsInline
                          preload={idx === 0 ? "auto" : "metadata"}
                          className="w-full max-h-64 object-contain"
                          data-testid={`profile-video-${idx}`}
                          ref={(el) => {
                            if (!el) return;
                            const obs = new IntersectionObserver(
                              ([entry]) => {
                                if (entry.isIntersecting) {
                                  el.load();
                                } else {
                                  el.pause();
                                }
                              },
                              { threshold: 0.5 }
                            );
                            obs.observe(el);
                          }}
                        />
                        {/* Location overlay */}
                        {(video as any).location && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5 pointer-events-none">
                            <span className="text-[10px] text-cyan-300">📍</span>
                            <span className="text-[10px] text-white truncate max-w-[120px]">{(video as any).location}</span>
                          </div>
                        )}
                        {/* GIF overlay */}
                        {(video as any).gifOverlayUrl && (
                          <div className="absolute top-6 right-2 pointer-events-none">
                            <img src={(video as any).gifOverlayUrl} alt="gif" className="w-14 h-14 object-contain rounded-lg" />
                          </div>
                        )}
                        {/* Caption overlay */}
                        {(video as any).caption && (
                          <div className="absolute bottom-8 left-0 right-0 px-2 pointer-events-none">
                            <div className="bg-black/70 rounded-lg px-2 py-1">
                              <p className="text-white text-xs font-medium text-center">{(video as any).caption}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.languages && profile.languages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-2">{t("swipe.languages")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.languages.map((lang, idx) => (
                      <Badge key={idx} variant="outline" className="bg-white/10 border-white/30 text-white">
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-white/10">
                {!showReportMenu ? (
                  <Button
                    variant="ghost"
                    className="w-full text-white/50 hover:text-red-400"
                    onClick={() => setShowReportMenu(true)}
                    data-testid={`button-report-${profile.id}`}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    {t("swipe.reportProfile")}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-white/60 text-center">{t("swipe.selectReason")}</p>
                    {reportReasons.map((reason) => (
                      <Button
                        key={reason.key}
                        variant="ghost"
                        className="w-full text-white/80 justify-start"
                        onClick={() => reportMutation.mutate({ reportedId: profile.id, reason: reason.value })}
                        disabled={reportMutation.isPending}
                        data-testid={`button-report-reason-${reason.key}`}
                      >
                        {reason.value}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full text-white/40"
                      onClick={() => setShowReportMenu(false)}
                      data-testid="button-cancel-report"
                    >
                      {t("swipe.cancel")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      <AnimatePresence>
        {viewingPhotoIndex !== null && allPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95"
            onClick={() => setViewingPhotoIndex(null)}
            data-testid="photo-viewer-overlay"
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 left-4 text-white bg-white/10 border border-white/20 z-10"
              onClick={(e) => { e.stopPropagation(); setViewingPhotoIndex(null); }}
              data-testid="button-close-photo-viewer"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="absolute top-5 right-4 text-white/60 text-sm z-10" data-testid="photo-viewer-counter">
              {viewingPhotoIndex + 1} / {allPhotos.length}
            </div>

            {viewingPhotoIndex > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-white/10 border border-white/20 z-10"
                onClick={(e) => { e.stopPropagation(); setViewingPhotoIndex(viewingPhotoIndex - 1); }}
                data-testid="button-photo-prev"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}

            {viewingPhotoIndex < allPhotos.length - 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-white/10 border border-white/20 z-10"
                onClick={(e) => { e.stopPropagation(); setViewingPhotoIndex(viewingPhotoIndex + 1); }}
                data-testid="button-photo-next"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}

            <motion.img
              key={viewingPhotoIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              src={allPhotos[viewingPhotoIndex]}
              alt={`${t("swipe.photos")} ${viewingPhotoIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              data-testid="photo-viewer-image"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const REACTIONS = [
  { key: "fire",  emoji: "🔥", label: "Fuoco" },
  { key: "ufo",   emoji: "🛸", label: "Vibra"  },
  { key: "spark", emoji: "✨", label: "Wow"   },
  { key: "crush", emoji: "😍", label: "Crush" },
] as const;

function ReactionBar({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ counts: Record<string, number>; myReaction: string | null }>({
    queryKey: ["/api/profiles", profileId, "reactions"],
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: async (reaction: string) => apiRequest("POST", "/api/reactions", { toProfileId: profileId, reaction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/profiles", profileId, "reactions"] }),
    onError: () => toast({ title: "Errore", description: "Non è stato possibile inviare la reazione", variant: "destructive" }),
  });

  if (isLoading) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-1.5 pointer-events-auto" data-testid={`reaction-bar-${profileId}`}>
      {REACTIONS.map(({ key, emoji, label }) => {
        const count = data?.counts?.[key] ?? 0;
        const isActive = data?.myReaction === key;
        return (
          <motion.button
            key={key}
            whileTap={{ scale: 1.3 }}
            onClick={(e) => { e.stopPropagation(); if (!mutation.isPending) mutation.mutate(key); }}
            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold backdrop-blur-sm transition-all border ${
              isActive
                ? "bg-white/25 border-white/60 shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                : "bg-black/30 border-white/15 hover:bg-white/10"
            }`}
            data-testid={`reaction-btn-${key}-${profileId}`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && <span className="text-white/80">{count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

interface SwipeCardProps {
  profile: Profile;
  onSwipe: (direction: "left" | "right") => void;
  isTop?: boolean;
  hasPrivateRoom?: boolean;
  alreadyLiked?: boolean;
  actionButtons?: React.ReactNode;
  topOverlay?: React.ReactNode;
  globalMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  onOpenPostComposer?: () => void;
}

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  function SwipeCard({ profile, onSwipe, isTop = false, hasPrivateRoom = false, alreadyLiked = false, actionButtons, topOverlay, globalMuted, onMutedChange, onOpenPostComposer }, ref) {
    const [exitX, setExitX] = useState(0);
    const [exitY, setExitY] = useState(0);
    const [showDetail, setShowDetail] = useState(false);
    const [showRating, setShowRating] = useState(false);
    const [showStories, setShowStories] = useState(false);
    const [selectedRating, setSelectedRating] = useState<number | null>(null);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(() => {
      if (!profile.imageUrl) return false;
      const img = new window.Image();
      img.src = profile.imageUrl;
      return img.complete;
    });
    const [imageError, setImageError] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [isCardMuted, setIsCardMuted] = useState(globalMuted ?? false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(false);
    const [showSignalCompose, setShowSignalCompose] = useState(false);
    const [signalText, setSignalText] = useState("");
    const [signalSent, setSignalSent] = useState(false);

    // Vibrapp direct compose
    const [showVibCompose, setShowVibCompose] = useState(false);
    const [vibText, setVibText] = useState("");
    const [vibSent, setVibSent] = useState(false);
    const [vibSentContent, setVibSentContent] = useState("");
    const [vibReply, setVibReply] = useState<string | null>(null);
    const [vibPrivateRoomId, setVibPrivateRoomId] = useState<string | null>(null);
    const [vibChatMsgs, setVibChatMsgs] = useState<{ role: "me" | "bot"; text: string }[]>([]);
    const [vibContinueText, setVibContinueText] = useState("");
    const [vibWaitingBotReply, setVibWaitingBotReply] = useState(false);
    const vibPollRef = useRef<NodeJS.Timeout | null>(null);
    const vibRoomPollRef = useRef<NodeJS.Timeout | null>(null);
    const vibKnownMsgCountRef = useRef(0);
    const vibChatEndRef = useRef<HTMLDivElement | null>(null);
    const [vibIsRecording, setVibIsRecording] = useState(false);
    const [vibRecordingDuration, setVibRecordingDuration] = useState(0);
    const [vibAudioFile, setVibAudioFile] = useState<File | null>(null);
    const [vibAudioUrl, setVibAudioUrl] = useState<string | null>(null);
    const [vibIsUploading, setVibIsUploading] = useState(false);
    const vibMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const vibAudioChunksRef = useRef<Blob[]>([]);
    const vibTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Scorro sempre in fondo quando arrivano nuovi messaggi
    useEffect(() => {
      vibChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [vibChatMsgs, vibWaitingBotReply]);

    // Polling per risposta bot (cold message check → prima risposta)
    useEffect(() => {
      if (!vibSent || vibReply !== null) return;
      const poll = async () => {
        try {
          const res = await fetch(`/api/cold-messages/check/${profile.id}`, { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          if (data.replied && data.replyContent) {
            setVibReply(data.replyContent);
            setVibPrivateRoomId(data.privateRoomId ?? null);
            setVibChatMsgs([{ role: "bot", text: data.replyContent }]);
            vibKnownMsgCountRef.current = 2; // msg utente + prima risposta già in state
            if (vibPollRef.current) clearInterval(vibPollRef.current);
          }
        } catch {}
      };
      vibPollRef.current = setInterval(poll, 5000);
      return () => { if (vibPollRef.current) clearInterval(vibPollRef.current); };
    }, [vibSent, vibReply, profile.id]);

    // Polling messaggi della private room (conversazione continuata)
    useEffect(() => {
      if (!vibPrivateRoomId) return;
      const pollRoom = async () => {
        try {
          const res = await fetch(`/api/private-rooms/${vibPrivateRoomId}/messages`, { credentials: "include" });
          if (!res.ok) return;
          const msgs: any[] = await res.json();
          const newMsgs = msgs.slice(vibKnownMsgCountRef.current);
          if (newMsgs.length > 0) {
            const myProfileId = msgs.find((m: any) => m.senderId !== profile.id)?.senderId; // heuristic
            setVibChatMsgs(prev => {
              const additions = newMsgs.map((m: any) => ({ role: m.senderId === profile.id ? "bot" as const : "me" as const, text: m.content }));
              // Solo i messaggi bot nuovi (non quello che abbiamo appena inviato noi)
              const botAdditions = newMsgs
                .filter((m: any) => m.senderId === profile.id)
                .map((m: any) => ({ role: "bot" as const, text: m.content }));
              if (botAdditions.length > 0) setVibWaitingBotReply(false);
              return botAdditions.length > 0 ? [...prev, ...botAdditions] : prev;
            });
            vibKnownMsgCountRef.current = msgs.length;
          }
        } catch {}
      };
      vibRoomPollRef.current = setInterval(pollRoom, 4000);
      return () => { if (vibRoomPollRef.current) clearInterval(vibRoomPollRef.current); };
    }, [vibPrivateRoomId, profile.id]);

    const vibSendContinue = useCallback(async () => {
      const text = vibContinueText.trim();
      if (!text || !vibPrivateRoomId) return;
      setVibChatMsgs(prev => [...prev, { role: "me", text }]);
      setVibContinueText("");
      setVibWaitingBotReply(true);
      vibKnownMsgCountRef.current += 1;
      try {
        await fetch(`/api/private-rooms/${vibPrivateRoomId}/messages`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
      } catch {}
    }, [vibContinueText, vibPrivateRoomId]);

    const vibClose = useCallback(async () => {
      if (vibPollRef.current) clearInterval(vibPollRef.current);
      if (vibRoomPollRef.current) clearInterval(vibRoomPollRef.current);
      try { await fetch(`/api/cold-messages/sent/${profile.id}`, { method: "DELETE", credentials: "include" }); } catch {}
      setShowVibCompose(false);
      setVibSent(false);
      setVibSentContent("");
      setVibReply(null);
      setVibPrivateRoomId(null);
      setVibChatMsgs([]);
      setVibContinueText("");
      setVibWaitingBotReply(false);
      vibKnownMsgCountRef.current = 0;
      setVibText("");
      vibCancelRecording?.();
      vibClearAudio?.();
    }, [profile.id]);

    const [keyboardPadding, setKeyboardPadding] = useState(0);
    const [navHeight, setNavHeight] = useState(130);
    useEffect(() => {
      const vv = window.visualViewport;
      if (!vv) return;
      const handler = () => {
        const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setKeyboardPadding(offset);
      };
      vv.addEventListener("resize", handler);
      vv.addEventListener("scroll", handler);
      return () => {
        vv.removeEventListener("resize", handler);
        vv.removeEventListener("scroll", handler);
      };
    }, []);
    useEffect(() => {
      const measure = () => {
        const nav = document.querySelector('[data-testid="bottom-nav"]');
        if (nav) setNavHeight(nav.getBoundingClientRect().height);
      };
      measure();
      const obs = new ResizeObserver(measure);
      const nav = document.querySelector('[data-testid="bottom-nav"]');
      if (nav) obs.observe(nav);
      return () => obs.disconnect();
    }, []);

    const cardVideoRef = useRef<HTMLVideoElement>(null);
    const dragDistanceRef = useRef(0);
    const { toast } = useToast();
    const { t } = useLanguage();
    const [, navigate] = useLocation();

    const { data: cardVideos = [] } = useQuery<ProfileVideo[]>({
      queryKey: ['/api/profiles', profile.id, 'videos'],
      staleTime: 5 * 60 * 1000,
    });
  const { data: profileSignals = [] } = useQuery<any[]>({
    queryKey: ['/api/signals/profile', profile.id],
    staleTime: 60 * 1000,
  });
  const profileMedia = [...profileSignals]
    .filter((signal: any) => signal.mediaUrl)
    .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const activeProfileMedia = profileMedia[0] || null;
    const hasVideos = cardVideos.length > 0;

    useEffect(() => {
      const extras = profile.photos || [];
      extras.forEach((url: string) => {
        const img = new window.Image();
        img.src = url;
      });
    }, [profile.id, profile.photos]);

    useEffect(() => {
      setIsCardMuted(globalMuted ?? false);
    }, [globalMuted]);

    // Handler per buffering a metà riproduzione (rete lenta durante play)
    useEffect(() => {
      if (!isTop) return;
      const video = cardVideoRef.current;
      if (!video) return;
      const onWaiting = () => setIsVideoBuffering(true);
      const onPlaying = () => setIsVideoBuffering(false);
      const onCanPlayThrough = () => setIsVideoBuffering(false);
      video.addEventListener("waiting", onWaiting);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("canplaythrough", onCanPlayThrough);
      return () => {
        video.removeEventListener("waiting", onWaiting);
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("canplaythrough", onCanPlayThrough);
      };
    }, [isTop]);

    // TikTok-style video play/pause con buffering indicator
    useEffect(() => {
      const video = cardVideoRef.current;
      const hasVideo = !!(profile.profileVideoUrl || (activeProfileMedia?.mediaType === "video" && activeProfileMedia?.mediaUrl));
      if (!video || !hasVideo) return;

      const wantAudio = !(globalMuted ?? false);

      const doPlay = () => {
        video.muted = true;
        video.volume = 1;
        const p = video.play();
        if (p) p.then(() => {
          setIsVideoBuffering(false);
          if (wantAudio) {
            video.muted = false;
            setTimeout(() => { if (video.muted) setIsCardMuted(true); }, 150);
          }
        }).catch(() => {
          // Autoplay bloccato: riprova sempre muted
          video.muted = true;
          video.play().catch(() => {});
        });
      };

      if (isTop) {
        // Mostra spinner solo se non ancora pronto
        if (video.readyState >= 2) {
          // Già bufferizzato: play immediato senza spinner
          setIsVideoBuffering(false);
          doPlay();
        } else {
          setIsVideoBuffering(true);
          const onCanPlay = () => {
            setIsVideoBuffering(false);
            doPlay();
            cleanup();
          };
          const onPlaying = () => {
            setIsVideoBuffering(false);
            cleanup();
          };
          // Timeout di sicurezza: dopo 2.5s prova a fare play comunque
          const timeout = setTimeout(() => {
            setIsVideoBuffering(false);
            doPlay();
            cleanup();
          }, 2500);

          const cleanup = () => {
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("playing", onPlaying);
            clearTimeout(timeout);
          };

          video.addEventListener("canplay", onCanPlay);
          video.addEventListener("playing", onPlaying);

          // Avvia caricamento solo se non già in corso
          if (video.readyState === 0) video.load();

          return cleanup;
        }

        // Buffering durante la riproduzione (rete lenta)
        const onWaiting = () => setIsVideoBuffering(true);
        const onPlaying2 = () => setIsVideoBuffering(false);
        video.addEventListener("waiting", onWaiting);
        video.addEventListener("playing", onPlaying2);
        return () => {
          video.removeEventListener("waiting", onWaiting);
          video.removeEventListener("playing", onPlaying2);
        };
      } else {
        // Prewarm della card successiva: carica e prova a partire in background
        video.muted = true;
        video.preload = "auto";
        video.load();
        video.play().then(() => {
          video.pause();
          video.currentTime = 0;
        }).catch(() => {
          if (video.readyState === 0) video.load();
        });
      }
    }, [isTop, profile.profileVideoUrl, activeProfileMedia?.id]);

    const ratingMutation = useMutation({
      mutationFn: async (rating: number) => {
        return apiRequest("POST", "/api/ratings", { ratedId: profile.id, rating });
      },
      onSuccess: () => {
        setRatingSubmitted(true);
        const ratingLabels: Record<number, string> = { 1: t("pi.rating1"), 2: t("pi.rating2"), 3: t("pi.rating3"), 4: t("pi.rating4"), 5: t("pi.rating5") };
        toast({ title: t("swipe.voteSent"), description: `${ratingLabels[selectedRating!] || ""} - ${profile.name}` });
        queryClient.invalidateQueries({ queryKey: ["/api/ratings/received"] });
        setTimeout(() => setShowRating(false), 1500);
      },
      onError: (error: Error) => {
        if (error.message.includes("Already rated")) {
          toast({ title: t("swipe.alreadyVoted"), description: t("swipe.alreadyVotedDesc"), variant: "destructive" });
        } else {
          toast({ title: t("common.error"), description: t("swipe.voteError"), variant: "destructive" });
        }
        setShowRating(false);
      },
    });

    const { data: favoritesData } = useQuery<{ favoritedProfileId: string }[]>({
      queryKey: ["/api/favorites"],
      staleTime: 60 * 1000,
      enabled: isTop,
    });
    useEffect(() => {
      if (favoritesData) {
        setIsFavorited(favoritesData.some(f => f.favoritedProfileId === profile.id));
      }
    }, [favoritesData, profile.id]);

    const toggleFavoriteMutation = useMutation({
      mutationFn: async () => {
        if (isFavorited) {
          return apiRequest("DELETE", `/api/favorites/${profile.id}`);
        } else {
          return apiRequest("POST", `/api/favorites/${profile.id}`);
        }
      },
      onSuccess: () => {
        const next = !isFavorited;
        setIsFavorited(next);
        queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
        toast({ title: next ? `⭐ Aggiunto ai preferiti` : `Rimosso dai preferiti`, description: profile.name });
      },
    });

    const sendSignalMutation = useMutation({
      mutationFn: () => apiRequest("POST", "/api/signals", {
        content: signalText.trim(),
        mediaType: "text",
        toProfileId: profile.id,
      }),
      onSuccess: () => {
        setSignalSent(true);
        setSignalText("");
        queryClient.invalidateQueries({ queryKey: ["/api/signals/received"] });
        setTimeout(() => { setShowSignalCompose(false); setSignalSent(false); }, 1800);
      },
      onError: (err: any) => {
        if (err?.status === 401 || err?.message?.includes("401")) {
          toast({ title: "Accesso richiesto", description: "Registrati per inviare Cosmic Signal", variant: "destructive" });
        } else {
          toast({ title: "Errore", description: "Impossibile inviare il Signal", variant: "destructive" });
        }
      },
    });

    const sendColdMsgMutation = useMutation({
      mutationFn: (vars: { toProfileId: string; content: string; mediaUrl?: string; mediaType?: string }) =>
        apiRequest("POST", "/api/cold-messages", vars),
      onSuccess: (_data: any, vars: any) => {
        setVibSentContent(vars.content || "");
        setVibSent(true);
        setVibText("");
        vibClearAudio();
      },
      onError: () => toast({ title: "Errore", description: "Impossibile inviare il messaggio", variant: "destructive" }),
    });

    const vibStartRecording = useCallback(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
        const recorder = new MediaRecorder(stream, { mimeType });
        vibAudioChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) vibAudioChunksRef.current.push(e.data); };
        recorder.start(100);
        vibMediaRecorderRef.current = recorder;
        setVibIsRecording(true);
        setVibRecordingDuration(0);
        vibTimerRef.current = setInterval(() => setVibRecordingDuration(d => d + 1), 1000);
      } catch {
        toast({ title: "Microfono non disponibile", description: "Controlla i permessi del browser", variant: "destructive" });
      }
    }, [toast]);

    const vibStopRecording = useCallback(() => {
      const recorder = vibMediaRecorderRef.current;
      if (!recorder) return;
      if (vibTimerRef.current) clearInterval(vibTimerRef.current);
      recorder.onstop = () => {
        const baseMime = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(vibAudioChunksRef.current, { type: baseMime });
        const ext = baseMime.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `vocale_${Date.now()}.${ext}`, { type: baseMime });
        const url = URL.createObjectURL(blob);
        if (vibAudioUrl) URL.revokeObjectURL(vibAudioUrl);
        setVibAudioFile(file);
        setVibAudioUrl(url);
      };
      recorder.stop();
      recorder.stream.getTracks().forEach(t => t.stop());
      setVibIsRecording(false);
      setVibRecordingDuration(0);
      vibMediaRecorderRef.current = null;
    }, [vibAudioUrl]);

    const vibCancelRecording = useCallback(() => {
      const recorder = vibMediaRecorderRef.current;
      if (recorder) { recorder.stop(); recorder.stream.getTracks().forEach(t => t.stop()); }
      if (vibTimerRef.current) clearInterval(vibTimerRef.current);
      vibMediaRecorderRef.current = null;
      vibAudioChunksRef.current = [];
      setVibIsRecording(false);
      setVibRecordingDuration(0);
    }, []);

    const vibClearAudio = useCallback(() => {
      if (vibAudioUrl) URL.revokeObjectURL(vibAudioUrl);
      setVibAudioFile(null);
      setVibAudioUrl(null);
    }, [vibAudioUrl]);

    const vibSubmit = useCallback(async () => {
      if (vibAudioFile) {
        setVibIsUploading(true);
        try {
          const uploadRes = await fetch("/api/vibrapp/request-upload", {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentType: vibAudioFile.type, size: vibAudioFile.size }),
          });
          if (!uploadRes.ok) { toast({ title: "Errore upload", variant: "destructive" }); return; }
          const { uploadURL, objectPath, mediaType } = await uploadRes.json();
          const putRes = await fetch(uploadURL, { method: "PUT", body: vibAudioFile, headers: { "Content-Type": vibAudioFile.type } });
          if (!putRes.ok) { toast({ title: "Upload fallito", variant: "destructive" }); return; }
          sendColdMsgMutation.mutate({ toProfileId: profile.id, content: vibText, mediaUrl: objectPath, mediaType });
        } finally {
          setVibIsUploading(false);
        }
      } else {
        sendColdMsgMutation.mutate({ toProfileId: profile.id, content: vibText });
      }
    }, [vibAudioFile, vibText, profile.id, sendColdMsgMutation, toast]);

    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
    
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    const isDraggingRef = useRef(false);

    const handleDragStart = () => {
      isDraggingRef.current = true;
      dragDistanceRef.current = 0;
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
      dragDistanceRef.current = Math.abs(info.offset.x) + Math.abs(info.offset.y);
      setTimeout(() => { isDraggingRef.current = false; }, 50);
      const absX = Math.abs(info.offset.x);
      const absY = Math.abs(info.offset.y);
      if (absY > absX && info.offset.y < -110) {
        setExitY(-700);
        setShowRating(false);
        setSelectedRating(null);
        onSwipe("left");
      } else if (info.offset.x > 100 && !alreadyLiked) {
        setExitX(300);
        setShowRating(false);
        setSelectedRating(null);
        onSwipe("right");
      } else if (info.offset.x < -100) {
        setExitX(-300);
        setShowRating(false);
        setSelectedRating(null);
        onSwipe("left");
      }
    };

    return (
      <>
        <motion.div
          ref={ref}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{ x, y, rotate, opacity, willChange: "transform" }}
          drag={isTop ? true : false}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={1}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          initial={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 20 }}
          animate={{ 
            scale: isTop ? 1 : 0.95, 
            y: isTop ? exitY || 0 : 20,
            x: exitX,
          }}
          exit={{ x: exitX, y: exitY, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          data-testid={`swipe-card-${profile.id}`}
        >
          <div className="relative overflow-hidden bg-black h-full"
          style={
            profile.highlightedUntil && new Date(profile.highlightedUntil) > new Date()
              ? { boxShadow: "inset 0 0 20px rgba(250, 204, 21, 0.4), 0 0 15px rgba(250, 204, 21, 0.3)" }
              : undefined
          }>
            <div className="relative h-full overflow-hidden">
              {activeProfileMedia ? (
                <>
                  {activeProfileMedia.mediaType === "video" ? (
                    <>
                      <video
                        ref={cardVideoRef}
                        key={activeProfileMedia.id}
                        autoPlay
                        loop
                        playsInline
                        preload="auto"
                        src={activeProfileMedia.mediaUrl}
                        poster={profile.imageUrl ?? undefined}
                        className="absolute inset-0 w-full h-full object-cover object-top z-10"
                        style={{ willChange: "transform" }}
                        data-testid={`profile-media-video-${profile.id}`}
                      />
                      {isTop && isVideoBuffering && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
                          className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors active:scale-95"
                          data-testid="button-card-profile-toggle"
                          style={{ touchAction: "manipulation" }}
                        >
                          <User className="w-6 h-6 text-white" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newMuted = !isCardMuted;
                            setIsCardMuted(newMuted);
                            onMutedChange?.(newMuted);
                            if (cardVideoRef.current) {
                              cardVideoRef.current.muted = newMuted;
                              if (!newMuted) cardVideoRef.current.volume = 1;
                            }
                          }}
                          className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors active:scale-95"
                          data-testid="button-card-mute-toggle"
                          style={{ touchAction: "manipulation" }}
                        >
                          {isCardMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        key={activeProfileMedia.id}
                        src={activeProfileMedia.mediaUrl}
                        alt={profile.name}
                        className="absolute inset-0 w-full h-full object-cover object-top z-10"
                        data-testid={`profile-media-image-${profile.id}`}
                      />
                      <div className="absolute top-3 left-3 z-30">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
                          className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors active:scale-95"
                          data-testid="button-card-profile-toggle"
                          style={{ touchAction: "manipulation" }}
                        >
                          <User className="w-6 h-6 text-white" />
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : profile.profileVideoUrl ? (
                <>
                  <video
                    ref={cardVideoRef}
                    key={profile.profileVideoUrl}
                    autoPlay
                    loop
                    playsInline
                    preload="auto"
                    src={profile.profileVideoUrl ?? undefined}
                    className="w-full h-full object-cover object-top"
                    poster={profile.imageUrl ?? undefined}
                    data-testid={`profile-video-${profile.id}`}
                    style={{ willChange: "transform" }}
                  />
                  {/* Spinner TikTok-style durante buffering — mai sui bot (poster già visibile) */}
                  {isTop && isVideoBuffering && !profile.isBot && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                    {/* Pulsante video */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetail(true);
                      }}
                      className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors active:scale-95"
                    data-testid="button-card-profile-toggle"
                      style={{ touchAction: "manipulation" }}
                    >
                      <User className="w-6 h-6 text-white" />
                    </button>
                    {/* Pulsante mute */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newMuted = !isCardMuted;
                        setIsCardMuted(newMuted);
                        onMutedChange?.(newMuted);
                        if (cardVideoRef.current) {
                          cardVideoRef.current.muted = newMuted;
                          if (!newMuted) cardVideoRef.current.volume = 1;
                        }
                      }}
                      className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors active:scale-95"
                      data-testid="button-card-mute-toggle"
                      style={{ touchAction: "manipulation" }}
                    >
                      {isCardMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {!imageLoaded && !imageError && (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-purple-900/50 to-black/80 animate-pulse" data-testid={`image-loading-${profile.id}`}>
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                        <User className="w-8 h-8 text-white/40" />
                      </div>
                    </div>
                  )}
                  <img
                    src={imageError ? "/images/avatar-1.png" : profile.imageUrl}
                    alt={profile.name}
                    className={`w-full h-full object-cover object-top transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                    data-testid={`profile-image-${profile.id}`}
                  />
                  <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetail(true);
                      }}
                      className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors active:scale-95"
                      data-testid="button-card-profile-toggle"
                      style={{ touchAction: "manipulation" }}
                    >
                      <User className="w-6 h-6 text-white" />
                    </button>
                  </div>
                </>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent pointer-events-none" style={{ height: '25%' }} />

              {topOverlay && (
                <div className="absolute top-0 left-0 right-0 z-20 pt-1 px-2 pointer-events-none">
                  {topOverlay}
                </div>
              )}

              {alreadyLiked && (
                <div className="absolute top-3 left-3 z-20 flex items-center gap-0.5 px-1.5 py-px rounded-full bg-pink-500/70 backdrop-blur-sm" data-testid={`liked-indicator-${profile.id}`}>
                  <Heart className="w-2.5 h-2.5 text-white fill-white" />
                  <span className="text-white text-[8px] font-bold">{t("swipe.likeDone")}</span>
                </div>
              )}


              {isTop && (
                <div className="absolute right-2 top-[5%] z-20 flex flex-col items-center gap-2 pointer-events-auto">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowStories(true); }}
                    className="flex flex-col items-center gap-0.5"
                    style={{ touchAction: "none" }}
                    data-testid={`button-stories-${profile.id}`}
                  >
                    <div className={`relative w-12 h-12 rounded-full p-[2.5px] ${hasVideos ? "bg-gradient-to-tr from-cyan-400 via-violet-500 to-emerald-400" : "bg-white/20"}`}>
                      <div className="w-full h-full rounded-full bg-black/70 overflow-hidden border border-black/40">
                        {profile.imageUrl ? (
                          <img src={profile.imageUrl} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-cyan-400 fill-cyan-400" />
                          </div>
                        )}
                      </div>
                      {hasVideos && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-black flex items-center justify-center border border-cyan-400/60">
                          <Play className="w-2 h-2 text-cyan-400 fill-cyan-400" />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Storie</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      setShowVibCompose(true);
                    }}
                    className="flex flex-col items-center gap-0.5"
                    style={{ touchAction: "none" }}
                    data-testid={`button-vibrapp-${profile.id}`}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#25D366", boxShadow: "0 0 14px rgba(37,211,102,0.6)" }}>
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[9px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Vibrapp</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleFavoriteMutation.mutate(); }}
                    className="flex flex-col items-center gap-0.5"
                    style={{ touchAction: "none" }}
                    data-testid={`button-favorite-${profile.id}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Bookmark className={`w-6 h-6 ${isFavorited ? "text-yellow-400 fill-yellow-400" : "text-white"}`} />
                    </div>
                    <span className="text-[9px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Preferiti</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={async (e) => {
                      e.stopPropagation(); e.preventDefault();
                      const shareUrl = `${window.location.origin}`;
                      if (navigator.share) {
                        try { await navigator.share({ title: `${profile.name}, ${profile.age}`, text: `Guarda questo profilo su Vibra!`, url: shareUrl }); }
                        catch {}
                      } else {
                        await navigator.clipboard.writeText(shareUrl);
                        toast({ title: "Link copiato!" });
                      }
                    }}
                    className="flex flex-col items-center gap-0.5"
                    style={{ touchAction: "none" }}
                    data-testid={`button-share-${profile.id}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Share2 className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[9px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{t("swipe.share")}</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      if (profile.ratingEnabled) {
                        setShowRating(true); setSelectedRating(null); setRatingSubmitted(false);
                      } else {
                        toast({ title: "Non disponibile", description: `${profile.name} non ha attivato le impressioni` });
                      }
                    }}
                    className="flex flex-col items-center gap-0.5"
                    style={{ touchAction: "none" }}
                    data-testid={`button-impression-${profile.id}`}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #c026d3, #a855f7)", boxShadow: "0 0 14px rgba(192,38,211,0.55)", opacity: profile.ratingEnabled ? 1 : 0.45 }}>
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[9px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Impression</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      if (!alreadyLiked) onSwipe("right");
                    }}
                    disabled={alreadyLiked}
                    className="flex flex-col items-center gap-0.5"
                    style={{ touchAction: "none" }}
                    data-testid={`button-like-sidebar-${profile.id}`}
                  >
                    <div className={`w-12 h-12 rounded-full backdrop-blur-sm border flex items-center justify-center ${alreadyLiked ? "bg-pink-500/40 border-pink-400/50" : "bg-gradient-to-br from-pink-500/60 to-rose-600/60 border-pink-400/40"}`}
                      style={{ boxShadow: alreadyLiked ? "none" : "0 0 16px rgba(236,72,153,0.5)" }}>
                      <Heart className={`w-6 h-6 ${alreadyLiked ? "text-pink-300 fill-pink-300" : "text-white fill-white"}`} />
                    </div>
                    <span className="text-[11px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{t("home.like")}</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      setShowSignalCompose(true);
                    }}
                    className="flex flex-col items-center gap-0.5"
                    style={{ touchAction: "none" }}
                    data-testid={`button-signals-sidebar-${profile.id}`}
                  >
                    <div className="w-12 h-12 rounded-full backdrop-blur-sm border border-fuchsia-400/40 flex items-center justify-center bg-gradient-to-br from-fuchsia-500/60 to-purple-600/60"
                      style={{ boxShadow: "0 0 14px rgba(217,70,239,0.45)" }}>
                      <Radio className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[9px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Signal</span>
                  </motion.button>

                  {onOpenPostComposer && (
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpenPostComposer(); }}
                      className="flex flex-col items-center gap-0.5"
                      style={{ touchAction: "none" }}
                      data-testid="button-open-post-composer"
                    >
                      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-fuchsia-500/90 backdrop-blur-sm border border-white/20" style={{ boxShadow: "0 0 14px rgba(217,70,239,0.5)" }}>
                        <Plus className="w-8 h-8 text-white" />
                      </div>
                      <span className="text-[9px] font-bold text-white drop-shadow-lg" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>Post</span>
                    </motion.button>
                  )}
                </div>
              )}
              
              {!alreadyLiked && (
                <motion.div 
                  className="absolute top-1/3 right-6 px-4 py-2 rounded-lg border-2 border-green-400 bg-green-400/20 backdrop-blur-sm pointer-events-none z-10"
                  style={{ opacity: likeOpacity }}
                >
                  <span className="text-green-400 font-bold text-xl tracking-wider">LIKE</span>
                </motion.div>
              )}
              
              {!alreadyLiked && (
                <motion.div 
                  className="absolute top-1/3 left-6 px-4 py-2 rounded-lg border-2 border-red-400 bg-red-400/20 backdrop-blur-sm pointer-events-none z-10"
                  style={{ opacity: nopeOpacity }}
                >
                  <span className="text-red-400 font-bold text-xl tracking-wider">NOPE</span>
                </motion.div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
                <div className="pl-4 pr-16 pb-2 pt-8">
                  <div className="flex items-end justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-2xl leading-tight drop-shadow-lg" data-testid={`card-name-${profile.id}`}>
                          {profile.name}
                        </span>
                        <span className="text-white/90 font-semibold text-xl leading-tight drop-shadow-lg" data-testid={`card-age-${profile.id}`}>
                          {profile.age}
                        </span>
                        {profile.isVerified && (
                          <BadgeCheck className="w-5 h-5 text-blue-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {profile.location && (
                          <div className="flex items-center gap-1" data-testid={`card-location-${profile.id}`}>
                            <MapPin className="w-3.5 h-3.5 text-white/70 shrink-0" />
                            <span className="text-white/80 text-sm drop-shadow">{profile.location}</span>
                          </div>
                        )}
                        {(() => {
                          const activity = getActivityStatus((profile as any).lastActiveAt, t);
                          if (!activity.label) return null;
                          return (
                            <div className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${activity.color} ${activity.isOnline ? "animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]" : ""}`} />
                              <span className="text-white/70 text-xs">{activity.label}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                {profileSignals.length > 0 && (
                  <div className="px-4 pb-2 pointer-events-auto">
                    <div className="flex gap-2 overflow-x-auto scrollbar-none">
                      {profileSignals.slice(0, 3).map((signal: any) => (
                        <div
                          key={signal.id}
                          className="min-w-[180px] max-w-[240px] rounded-2xl p-3 border border-white/15 backdrop-blur-md"
                          style={{
                            background: signal.backgroundColor || "rgba(255,255,255,0.08)",
                            color: signal.textColor || "#ffffff",
                          }}
                          data-testid={`signal-card-${signal.id}`}
                        >
                          <div className="text-xs font-semibold line-clamp-4">
                            {signal.content || " "}
                          </div>
                          {signal.mediaUrl && signal.mediaType === "image" && (
                            <img src={signal.mediaUrl} alt="" className="mt-2 w-full h-24 object-cover rounded-xl" />
                          )}
                          {signal.mediaUrl && signal.mediaType === "video" && (
                            <video src={signal.mediaUrl} controls className="mt-2 w-full h-24 object-cover rounded-xl" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isTop && <ReactionBar profileId={profile.id} />}
                {actionButtons && (
                  <div className="pointer-events-auto pb-safe px-4">
                    {actionButtons}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>


        <AnimatePresence>
          {showRating && profile.ratingEnabled && isTop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              onClick={() => { setShowRating(false); setSelectedRating(null); }}
              data-testid="rating-overlay"
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative bg-black/95 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-2xl w-full max-w-[320px]"
                onClick={(e) => e.stopPropagation()}
                data-testid="rating-selector"
              >
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
                  <Avatar className="w-12 h-12 border-2 border-primary/50">
                    <AvatarImage src={profile.imageUrl || undefined} alt={profile.name} />
                    <AvatarFallback className="bg-primary/30 text-white text-sm">{profile.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-white text-base font-semibold leading-tight">{profile.name}, {profile.age}</span>
                    <span className="text-white/50 text-xs leading-tight mt-0.5">{t("swipe.piPrompt")}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { value: 1, label: t("pi.rating1") },
                    { value: 2, label: t("pi.rating2") },
                    { value: 3, label: t("pi.rating3") },
                    { value: 4, label: t("pi.rating4") },
                    { value: 5, label: t("pi.rating5") },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedRating(opt.value)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                        selectedRating === opt.value
                          ? "bg-primary text-white ring-2 ring-primary/50"
                          : "bg-white/10 text-white/80 active:bg-white/20"
                      }`}
                      data-testid={`rating-${opt.value}`}
                    >
                      <span className="w-7 h-7 rounded-full border-2 border-current flex items-center justify-center shrink-0 text-xs font-bold">{opt.value}</span>
                      <span className="leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setShowRating(false); setSelectedRating(null); }}
                    className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 text-sm font-medium active:bg-white/20"
                    data-testid="button-cancel-rating"
                  >
                    {t("swipe.cancel")}
                  </button>
                  <button
                    onClick={() => { if (selectedRating) ratingMutation.mutate(selectedRating); }}
                    disabled={!selectedRating || ratingMutation.isPending || ratingSubmitted}
                    className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 active:bg-primary/80"
                    data-testid="button-submit-rating"
                  >
                    {ratingSubmitted ? t("swipe.sent") : ratingMutation.isPending ? "..." : t("swipe.sendVote")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Vibrapp direct compose sheet ── */}
        <AnimatePresence>
          {showVibCompose && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-end justify-center"
              style={{ paddingBottom: `${navHeight + keyboardPadding}px` }}
              onClick={vibClose}
              data-testid="vibrapp-compose-overlay"
            >
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-lg bg-teal-100 border-t border-teal-300 rounded-t-2xl p-5 pb-10"
                onClick={e => e.stopPropagation()}
                data-testid="vibrapp-compose-panel"
              >
                <div className="w-10 h-1 bg-teal-400 rounded-full mx-auto mb-4" />
                {vibSent ? (
                  <div className="flex flex-col" style={{ height: "min(60vh, 420px)" }}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <img src={profile.imageUrl} alt={profile.name} className="w-8 h-8 rounded-full object-cover border-2 border-teal-600/60" />
                        <div>
                          <p className="text-teal-900 font-bold text-sm leading-tight">{profile.name}</p>
                          <p className="text-teal-600 text-[10px]">
                            {!vibReply ? "Sta scrivendo…" : vibWaitingBotReply ? "Sta rispondendo…" : "Online"}
                          </p>
                        </div>
                      </div>
                      <button onClick={vibClose} className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1" data-testid="button-vib-close">
                        🗑 Chiudi
                      </button>
                    </div>

                    {/* Chat scrollabile */}
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 mb-3">
                      {/* Primo messaggio utente */}
                      {vibSentContent && (
                        <div className="flex justify-end">
                          <div className="bg-teal-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[82%]">
                            <p className="text-sm leading-relaxed break-words">{vibSentContent}</p>
                          </div>
                        </div>
                      )}

                      {/* Prima risposta bot o puntini attesa */}
                      {!vibReply ? (
                        <div className="flex justify-start">
                          <div className="bg-white border border-teal-200 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      ) : null}

                      {/* Messaggi successivi (me + bot) */}
                      {vibChatMsgs.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "me" ? "justify-end" : "justify-start"}`}>
                          <div className={`rounded-2xl px-3 py-2 max-w-[82%] ${m.role === "me" ? "bg-teal-600 text-white rounded-tr-sm" : "bg-white border border-teal-200 text-teal-900 rounded-tl-sm"}`}>
                            <p className="text-sm leading-relaxed break-words">{m.text}</p>
                          </div>
                        </div>
                      ))}

                      {/* Puntini attesa risposta bot (dopo i follow-up) */}
                      {vibWaitingBotReply && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-teal-200 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      )}
                      <div ref={vibChatEndRef} />
                    </div>

                    {/* Input di continuazione — appare dopo la prima risposta */}
                    {vibReply && (
                      <div className="shrink-0 flex items-center gap-2 bg-white border border-teal-300 rounded-2xl px-3 py-2">
                        <input
                          type="text"
                          className="flex-1 bg-transparent text-teal-900 text-sm outline-none placeholder:text-teal-400"
                          placeholder={`Rispondi a ${profile.name}…`}
                          value={vibContinueText}
                          onChange={e => setVibContinueText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); vibSendContinue(); } }}
                          data-testid="input-vib-continue"
                        />
                        <button
                          onClick={vibSendContinue}
                          disabled={!vibContinueText.trim() || vibWaitingBotReply}
                          className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center disabled:opacity-40 shrink-0"
                          data-testid="button-vib-send-continue"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={profile.imageUrl} alt={profile.name} className="w-11 h-11 rounded-full object-cover border-2 border-teal-600/60" />
                      <div>
                        <p className="text-teal-900 font-bold">{profile.name}, {profile.age}</p>
                        <p className="text-teal-700 text-xs flex items-center gap-1.5">
                          <MessageCircle className="w-3 h-3" /> Messaggio diretto su Vibrapp
                        </p>
                      </div>
                    </div>

                    {vibIsRecording ? (
                      <div className="flex items-center gap-3 bg-red-100 border border-red-300 rounded-xl px-4 py-3 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" />
                        <span className="text-sm text-red-700 font-medium flex-1">
                          {String(Math.floor(vibRecordingDuration / 60)).padStart(2, "0")}:{String(vibRecordingDuration % 60).padStart(2, "0")} — Registrazione…
                        </span>
                        <button onClick={vibCancelRecording} className="text-red-600 hover:text-red-800" data-testid="button-vib-cancel-rec">
                          <MicOff className="w-4 h-4" />
                        </button>
                        <button onClick={vibStopRecording} className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center hover:bg-teal-700" data-testid="button-vib-stop-rec">
                          <Square className="w-3.5 h-3.5 text-white fill-white" />
                        </button>
                      </div>
                    ) : vibAudioFile && vibAudioUrl ? (
                      <div className="flex items-center gap-3 bg-teal-200 border border-teal-400 rounded-xl px-3 py-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-teal-300 flex items-center justify-center shrink-0">
                          <Mic className="w-4 h-4 text-teal-700" />
                        </div>
                        <audio src={vibAudioUrl} controls className="flex-1 h-8" style={{ accentColor: "#0d9488" }} data-testid="vib-audio-preview" />
                        <button onClick={vibClearAudio} className="text-red-600 hover:text-red-800 shrink-0" data-testid="button-vib-clear-audio">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <textarea
                          className="w-full bg-teal-50 border border-teal-400 text-teal-900 text-sm rounded-xl p-3 resize-none outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-400 mb-2"
                          rows={3}
                          maxLength={500}
                          placeholder={`Scrivi a ${profile.name}…`}
                          value={vibText}
                          onChange={e => setVibText(e.target.value)}
                          data-testid="input-vib-text"
                          autoFocus
                        />
                        <div className="flex items-center justify-end mb-3">
                          <button
                            onClick={vibStartRecording}
                            className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-900 font-medium transition-colors"
                            data-testid="button-vib-start-rec"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            Registra vocale invece
                          </button>
                        </div>
                      </>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={vibClose}
                        className="flex-1 py-2.5 rounded-xl border border-teal-400 text-teal-700 text-sm font-medium hover:bg-teal-200 transition-colors"
                        data-testid="button-cancel-vib"
                      >Annulla</button>
                      <button
                        onClick={vibSubmit}
                        disabled={(!vibAudioFile && vibText.trim().length < 2) || vibIsUploading || sendColdMsgMutation.isPending || vibIsRecording}
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40 transition-opacity bg-teal-600 hover:bg-teal-700"
                        data-testid="button-send-vib"
                      >
                        {vibIsUploading || sendColdMsgMutation.isPending ? "Invio…" : "💬 Invia messaggio"}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Signal compose sheet ── */}
        <AnimatePresence>
          {showSignalCompose && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-end justify-center"
              style={{ paddingBottom: `${navHeight + keyboardPadding}px` }}
              onClick={() => { setShowSignalCompose(false); setSignalText(""); setSignalSent(false); }}
              data-testid="signal-compose-overlay"
            >
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-lg bg-green-100 border-t border-green-400 rounded-t-2xl p-5 pb-10"
                onClick={e => e.stopPropagation()}
                data-testid="signal-compose-panel"
              >
                <div className="w-10 h-1 bg-green-500 rounded-full mx-auto mb-4" />
                {signalSent ? (
                  <div className="text-center py-6">
                    <div className="text-5xl mb-3">🛸</div>
                    <p className="text-green-900 font-bold text-lg">{t("swipe.signalSent")}</p>
                    <p className="text-green-700 text-sm mt-1">{t("swipe.signalSentDesc").replace("{name}", profile.name)}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={profile.imageUrl} alt={profile.name} className="w-11 h-11 rounded-full object-cover border-2 border-green-600/60" />
                      <div>
                        <p className="text-green-900 font-bold">{profile.name}, {profile.age}</p>
                        <p className="text-green-700 text-xs flex items-center gap-1"><Radio className="w-3 h-3" /> {t("swipe.sendSignalDirect")}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 mb-3">
                      {SIGNAL_OPTIONS.map((option) => (
                        <button
                          key={option.title}
                          type="button"
                          onClick={() => setSignalText(`${option.icon} ${option.title} — ${option.description}`)}
                          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${signalText.startsWith(option.icon) ? "bg-green-600 text-white border-green-700" : "bg-green-50 text-green-900 border-green-300 hover:bg-green-100"}`}
                          data-testid={`button-signal-option-${option.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl leading-none">{option.icon}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm">{option.title}</div>
                              <div className={`text-xs leading-snug ${signalText.startsWith(option.icon) ? "text-white/80" : "text-green-700"}`}>{option.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowSignalCompose(false); setSignalText(""); }}
                        className="flex-1 py-2.5 rounded-xl border border-green-400 text-green-700 text-sm font-medium hover:bg-green-200 transition-colors"
                        data-testid="button-cancel-signal"
                      >Annulla</button>
                      <button
                        onClick={() => sendSignalMutation.mutate()}
                        disabled={signalText.trim().length < 2 || sendSignalMutation.isPending}
                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-40 transition-colors"
                        data-testid="button-send-signal"
                      >
                        {sendSignalMutation.isPending ? "Invio…" : "🛸 Invia Signal"}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ProfileDetailModal
          profile={profile}
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
          hasPrivateRoom={hasPrivateRoom}
        />

        {showStories && cardVideos.length > 0 && (
          <StoryViewer
            profile={{ name: profile.name, imageUrl: profile.imageUrl }}
            videos={cardVideos}
            onClose={() => setShowStories(false)}
          />
        )}
      </>
    );
  }
);

interface ActionButtonsProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSuperLike?: () => void;
  onUndo?: () => void;
  undoDisabled?: boolean;
  disabled?: boolean;
  likeDisabled?: boolean;
}

export function ActionButtons({ onSwipeLeft, onSwipeRight, onSuperLike, onUndo, undoDisabled, disabled, likeDisabled }: ActionButtonsProps) {
  if (!onSuperLike && !onUndo) return null;
  return (
    <div className="flex items-center justify-center gap-6 py-2 pb-3">
      {/* Undo button */}
      {onUndo && (
        <motion.button
          whileHover={{ scale: undoDisabled ? 1 : 1.1 }}
          whileTap={{ scale: undoDisabled ? 1 : 0.9 }}
          onClick={onUndo}
          disabled={undoDisabled}
          className="w-12 h-12 rounded-full bg-card border border-amber-500/50 flex items-center justify-center shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          data-testid="button-undo-swipe"
          title="Annulla ultimo swipe"
        >
          <RotateCcw className="w-5 h-5 text-amber-400" />
        </motion.button>
      )}

      {/* Super Like */}
      {onSuperLike && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onSuperLike}
          disabled={disabled}
          className="w-12 h-12 rounded-full bg-card border border-secondary/50 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="button-super-like"
        >
          <Star className="w-6 h-6 text-secondary" />
        </motion.button>
      )}
    </div>
  );
}
