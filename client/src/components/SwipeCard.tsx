import { useState, forwardRef, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { Heart, X, Star, MapPin, Sparkles, BadgeCheck, ChevronDown, ArrowLeft, User, Ruler, GraduationCap, MessageCircle, Briefcase, Lock, Flag, Eye, ChevronLeft, ChevronRight, ZoomIn, Crown, Play } from "lucide-react";
import { StoryViewer } from "@/components/StoriesBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Profile, ProfileVideo } from "@shared/schema";

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

  const allPhotos = [...new Set([profile.imageUrl, ...(profile.photos || [])].filter(Boolean))] as string[];

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
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-full aspect-[3/4] object-cover object-top"
                data-testid="detail-profile-image"
              />
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
                  <div className="space-y-2">
                    {profileVideos.map((video, idx) => (
                      <video
                        key={video.id}
                        src={`/api/video-stream/${video.id}`}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full rounded-xl border border-white/10 bg-black max-h-64 object-contain"
                        data-testid={`profile-video-${idx}`}
                      />
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
}

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  function SwipeCard({ profile, onSwipe, isTop = false, hasPrivateRoom = false, alreadyLiked = false, actionButtons, topOverlay }, ref) {
    const [exitX, setExitX] = useState(0);
    const [showDetail, setShowDetail] = useState(false);
    const [showRating, setShowRating] = useState(false);
    const [showStories, setShowStories] = useState(false);
    const [selectedRating, setSelectedRating] = useState<number | null>(null);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const dragDistanceRef = useRef(0);
    const { toast } = useToast();
    const { t } = useLanguage();

    const { data: cardVideos = [] } = useQuery<ProfileVideo[]>({
      queryKey: ['/api/profiles', profile.id, 'videos'],
      staleTime: 5 * 60 * 1000,
    });
    const hasVideos = cardVideos.length > 0;

    useEffect(() => {
      setImageLoaded(false);
      setImageError(false);
      if (profile.imageUrl) {
        const img = new window.Image();
        img.onload = () => setImageLoaded(true);
        img.onerror = () => setImageError(true);
        img.src = profile.imageUrl;
      }
      const extras = profile.photos || [];
      extras.forEach((url: string) => {
        const img = new window.Image();
        img.src = url;
      });
    }, [profile.imageUrl, profile.photos]);

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
    const x = useMotionValue(0);
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
      if (info.offset.x > 100 && !alreadyLiked) {
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

    const handleImageTap = () => {
      if (!isDraggingRef.current && isTop) {
        setShowDetail(true);
      }
    };

    return (
      <>
        <motion.div
          ref={ref}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{ x, rotate, opacity }}
          drag={isTop ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          initial={{ scale: isTop ? 1 : 0.95, y: isTop ? 0 : 20 }}
          animate={{ 
            scale: isTop ? 1 : 0.95, 
            y: isTop ? 0 : 20,
            x: exitX,
          }}
          exit={{ x: exitX, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          data-testid={`swipe-card-${profile.id}`}
        >
          <div className="relative overflow-hidden bg-black h-full"
          style={
            profile.highlightedUntil && new Date(profile.highlightedUntil) > new Date()
              ? { boxShadow: "inset 0 0 20px rgba(250, 204, 21, 0.4), 0 0 15px rgba(250, 204, 21, 0.3)" }
              : undefined
          }>
            <div className="relative h-full overflow-hidden">
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
                className={`w-full h-full object-cover object-top cursor-pointer transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                onClick={handleImageTap}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                data-testid={`profile-image-${profile.id}`}
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent pointer-events-none" style={{ height: '25%' }} />

              <div className="absolute top-0 left-0 right-0 z-20 flex flex-col gap-0.5 pt-0.5 px-2">
                {topOverlay && (
                  <div className="pointer-events-none">
                    {topOverlay}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  {profile.ratingEnabled && isTop && !showRating ? (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowRating(true); setSelectedRating(null); setRatingSubmitted(false); }}
                      className="pointer-events-auto flex items-center gap-0.5 px-1.5 py-px rounded-full bg-gradient-to-r from-pink-500/70 to-purple-600/70 backdrop-blur-sm text-white text-[8px] font-semibold border border-white/15"
                      style={{ touchAction: "none" }}
                      data-testid={`button-rate-${profile.id}`}
                    >
                      <Eye className="w-2.5 h-2.5" />
                      <span>{t("swipe.piButton")}</span>
                    </motion.button>
                  ) : <div />}

                  <div className="flex items-center gap-1">
                    {hasVideos && isTop && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowStories(true); }}
                        className="pointer-events-auto flex flex-col items-center gap-0.5"
                        style={{ touchAction: "none" }}
                        data-testid={`button-stories-${profile.id}`}
                      >
                        <div className="relative w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 via-violet-500 to-emerald-400 animate-pulse-slow">
                          <div className="w-full h-full rounded-full bg-black/80 flex items-center justify-center overflow-hidden border border-black">
                            {profile.imageUrl ? (
                              <img src={profile.imageUrl} alt="" className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                            )}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-black flex items-center justify-center border border-cyan-400/50">
                            <Play className="w-2 h-2 text-cyan-400 fill-cyan-400" />
                          </div>
                        </div>
                        <span className="text-[8px] font-bold text-cyan-300 drop-shadow-lg">STORIE</span>
                      </motion.button>
                    )}
                    {alreadyLiked && (
                      <div className="flex items-center gap-0.5 px-1.5 py-px rounded-full bg-pink-500/70 backdrop-blur-sm" data-testid={`liked-indicator-${profile.id}`}>
                        <Heart className="w-2.5 h-2.5 text-white fill-white" />
                        <span className="text-white text-[8px] font-bold">{t("swipe.likeDone")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
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
                <div className="px-4 pb-2 pt-8">
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
  disabled?: boolean;
  likeDisabled?: boolean;
}

export function ActionButtons({ onSwipeLeft, onSwipeRight, onSuperLike, disabled, likeDisabled }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-6 py-2 pb-3">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onSwipeLeft}
        disabled={disabled}
        className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm border border-red-400/50 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-swipe-left"
      >
        <X className="w-7 h-7 text-red-400" />
      </motion.button>
      
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
      
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onSwipeRight}
        disabled={disabled || likeDisabled}
        className="w-14 h-14 rounded-full bg-primary/80 backdrop-blur-sm flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ boxShadow: "0 0 20px rgba(var(--primary-rgb, 168,85,247), 0.5)" }}
        data-testid="button-swipe-right"
      >
        <Heart className="w-7 h-7 text-primary-foreground" />
      </motion.button>
    </div>
  );
}
