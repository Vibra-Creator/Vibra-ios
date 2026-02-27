import { useState, forwardRef, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { Heart, X, Star, MapPin, Sparkles, BadgeCheck, ChevronDown, ArrowLeft, User, Ruler, GraduationCap, MessageCircle, Briefcase, Lock, Flag, Eye, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Profile } from "@shared/schema";

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

function ProfileDetailModal({ profile, isOpen, onClose, hasPrivateRoom = false }: ProfileDetailModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(null);

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

  const allPhotos = [profile.imageUrl, ...(profile.photos || [])].filter(Boolean) as string[];

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
            <div className="relative shrink-0 cursor-pointer" onClick={() => setViewingPhotoIndex(0)}>
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-full aspect-[3/4] object-cover object-top"
                data-testid="detail-profile-image"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 pointer-events-none">
                <ZoomIn className="w-3.5 h-3.5 text-white/80" />
                <span className="text-xs text-white/80">{allPhotos.length}</span>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="absolute top-4 left-4 text-white bg-black/60 backdrop-blur-md border border-white/20 z-10"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                data-testid="button-close-profile-detail"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-3xl font-bold text-white" data-testid="detail-profile-name">
                    {profile.name}, {profile.age}
                  </h2>
                  {profile.isVerified && (
                    <BadgeCheck className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-white/80">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{profile.location}</span>
                  </div>
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

interface SwipeCardProps {
  profile: Profile;
  onSwipe: (direction: "left" | "right") => void;
  isTop?: boolean;
  hasPrivateRoom?: boolean;
  alreadyLiked?: boolean;
}

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  function SwipeCard({ profile, onSwipe, isTop = false, hasPrivateRoom = false, alreadyLiked = false }, ref) {
    const [exitX, setExitX] = useState(0);
    const [showDetail, setShowDetail] = useState(false);
    const [showRating, setShowRating] = useState(false);
    const [selectedRating, setSelectedRating] = useState<number | null>(null);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const dragDistanceRef = useRef(0);
    const { toast } = useToast();
    const { t } = useLanguage();

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
          className="absolute w-full h-full cursor-grab active:cursor-grabbing"
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
          <div className="relative rounded-2xl overflow-hidden bg-card shadow-2xl border border-card-border h-full">
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
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

              {alreadyLiked && (
                <div className="absolute top-4 right-4 z-20 pointer-events-none" data-testid={`liked-indicator-${profile.id}`}>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-500/90 backdrop-blur-sm shadow-lg">
                    <Heart className="w-4 h-4 text-white fill-white" />
                    <span className="text-white text-xs font-bold tracking-wide">{t("swipe.likeDone")}</span>
                  </div>
                </div>
              )}
              
              {!alreadyLiked && (
                <motion.div 
                  className="absolute top-6 right-6 px-4 py-2 rounded-lg border-2 border-green-400 bg-green-400/20 backdrop-blur-sm pointer-events-none"
                  style={{ opacity: likeOpacity }}
                >
                  <span className="text-green-400 font-bold text-xl tracking-wider">LIKE</span>
                </motion.div>
              )}
              
              {!alreadyLiked && (
                <motion.div 
                  className="absolute top-6 left-6 px-4 py-2 rounded-lg border-2 border-red-400 bg-red-400/20 backdrop-blur-sm pointer-events-none"
                  style={{ opacity: nopeOpacity }}
                >
                  <span className="text-red-400 font-bold text-xl tracking-wider">NOPE</span>
                </motion.div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="secondary" className="bg-primary/80 text-primary-foreground backdrop-blur-sm">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {profile.alienType}
                  </Badge>
                  {hasPrivateRoom && (
                    <Badge variant="secondary" className="bg-amber-500/80 text-white backdrop-blur-sm" data-testid={`badge-private-room-${profile.id}`}>
                      <Lock className="w-3 h-3 mr-1" />
                      {t("swipe.vipRoom")}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-3xl font-bold text-white" data-testid={`profile-name-${profile.id}`}>
                    {profile.name}, {profile.age}
                  </h2>
                  {profile.isVerified && (
                    <BadgeCheck className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1 text-white/80">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{profile.location}</span>
                  </div>
                  {(() => {
                    const activity = getActivityStatus((profile as any).lastActiveAt, t);
                    if (!activity.label) return null;
                    return (
                      <div className="flex items-center gap-1.5" data-testid={`activity-status-${profile.id}`}>
                        <span className={`w-2 h-2 rounded-full ${activity.color} ${activity.isOnline ? 'animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]' : ''}`} />
                        <span className="text-xs text-white/70 font-medium">{activity.label}</span>
                      </div>
                    );
                  })()}
                </div>
                
                <p className="text-white/90 text-sm line-clamp-2 mb-3" data-testid={`profile-bio-${profile.id}`}>
                  {profile.bio}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {profile.interests.slice(0, 3).map((interest, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="bg-white/10 border-white/30 text-white backdrop-blur-sm"
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {profile.ratingEnabled && isTop && !showRating && (
          <motion.div
            className="absolute top-4 left-4 z-30 pointer-events-auto"
            style={{ x, rotate, opacity }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowRating(true); setSelectedRating(null); setRatingSubmitted(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-500/90 to-purple-600/90 backdrop-blur-sm text-white text-xs font-semibold shadow-lg border border-white/20"
              style={{ touchAction: "none" }}
              data-testid={`button-rate-${profile.id}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="flex flex-col items-start leading-tight">
                <span>{t("swipe.piButton")}</span>
                <span className="text-[9px] font-normal text-white/70">{t("swipe.piSubtitle")}</span>
              </span>
            </motion.button>
          </motion.div>
        )}

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
    <div className="flex items-center justify-center gap-6 py-3">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onSwipeLeft}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-card border border-destructive/50 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-swipe-left"
      >
        <X className="w-8 h-8 text-destructive" />
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
        className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ boxShadow: "var(--glow-primary)" }}
        data-testid="button-swipe-right"
      >
        <Heart className="w-8 h-8 text-primary-foreground" />
      </motion.button>
    </div>
  );
}
