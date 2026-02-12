import { useState, forwardRef, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { Heart, X, Star, MapPin, Sparkles, BadgeCheck, ChevronDown, User, Ruler, GraduationCap, MessageCircle, Briefcase, Lock, Flag, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@shared/schema";

interface ProfileDetailModalProps {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
  hasPrivateRoom?: boolean;
}

function ProfileDetailModal({ profile, isOpen, onClose, hasPrivateRoom = false }: ProfileDetailModalProps) {
  const { toast } = useToast();
  const [showReportMenu, setShowReportMenu] = useState(false);

  const reportMutation = useMutation({
    mutationFn: (data: { reportedId: string; reason: string }) =>
      apiRequest("POST", "/api/reports", data),
    onSuccess: () => {
      toast({ title: "Segnalazione inviata", description: "Grazie per la tua segnalazione. Il nostro team la esaminerà." });
      setShowReportMenu(false);
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile inviare la segnalazione.", variant: "destructive" });
    },
  });

  const reportReasons = [
    "Contenuto inappropriato",
    "Profilo falso",
    "Comportamento molesto",
    "Spam",
    "Altro",
  ];

  if (!isOpen) return null;

  const detailItems = [
    { label: "Tipo Alieno", value: profile.alienType, icon: Sparkles },
    { label: "Genere", value: profile.gender, icon: User },
    { label: "Altezza", value: profile.height ? `${profile.height} cm` : null, icon: Ruler },
    { label: "Istruzione", value: profile.education, icon: GraduationCap },
    { label: "Stile di Vita", value: profile.lifestyle, icon: Briefcase },
    { label: "Comunicazione", value: profile.communicationStyle ? profile.communicationStyle.split(",").join(", ") : null, icon: MessageCircle },
  ].filter(item => item.value);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={onClose}
          data-testid="profile-detail-overlay"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="profile-detail-modal"
          >
            <div className="relative">
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-full aspect-[4/3] object-cover"
                data-testid="detail-profile-image"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              <Button
                size="icon"
                variant="ghost"
                className="absolute top-4 right-4 text-white bg-black/30 backdrop-blur-sm"
                onClick={onClose}
                data-testid="button-close-profile-detail"
              >
                <ChevronDown className="w-5 h-5" />
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
                <div className="flex items-center gap-1 text-white/80">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{profile.location}</span>
                </div>
              </div>
            </div>

            <div className="bg-black/90 backdrop-blur-xl p-6 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-primary/80 text-primary-foreground">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {profile.alienType}
                </Badge>
                {hasPrivateRoom && (
                  <Badge variant="secondary" className="bg-amber-500/80 text-white" data-testid={`detail-badge-private-room-${profile.id}`}>
                    <Lock className="w-3 h-3 mr-1" />
                    Ha una Stanza VIP
                  </Badge>
                )}
              </div>

              {profile.bio && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-2">Bio</h3>
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
                  <h3 className="text-sm font-semibold text-white/60 mb-2">Interessi</h3>
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
                  <h3 className="text-sm font-semibold text-white/60 mb-2">Foto</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {profile.photos.map((photo, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-white/10">
                        <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" data-testid={`detail-photo-${idx}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.languages && profile.languages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-white/60 mb-2">Lingue</h3>
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
                    Segnala profilo
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-white/60 text-center">Seleziona il motivo:</p>
                    {reportReasons.map((reason) => (
                      <Button
                        key={reason}
                        variant="ghost"
                        className="w-full text-white/80 justify-start"
                        onClick={() => reportMutation.mutate({ reportedId: profile.id, reason })}
                        disabled={reportMutation.isPending}
                        data-testid={`button-report-reason-${reason.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {reason}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full text-white/40"
                      onClick={() => setShowReportMenu(false)}
                      data-testid="button-cancel-report"
                    >
                      Annulla
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface SwipeCardProps {
  profile: Profile;
  onSwipe: (direction: "left" | "right") => void;
  isTop?: boolean;
  hasPrivateRoom?: boolean;
}

export const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  function SwipeCard({ profile, onSwipe, isTop = false, hasPrivateRoom = false }, ref) {
    const [exitX, setExitX] = useState(0);
    const [showDetail, setShowDetail] = useState(false);
    const [showRating, setShowRating] = useState(false);
    const [selectedRating, setSelectedRating] = useState<number | null>(null);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);
    const dragDistanceRef = useRef(0);
    const { toast } = useToast();

    const ratingMutation = useMutation({
      mutationFn: async (rating: number) => {
        return apiRequest("POST", "/api/ratings", { ratedId: profile.id, rating });
      },
      onSuccess: () => {
        setRatingSubmitted(true);
        const ratingLabels: Record<number, string> = { 1: "Preferisco non pronunciarmi", 2: "Non sei il mio tipo", 3: "Qualcosa in te mi attrae", 4: "Sei il mio tipo ideale", 5: "Sei fantastico/a!" };
        toast({ title: "Voto inviato!", description: `${ratingLabels[selectedRating!] || ""} - ${profile.name}` });
        queryClient.invalidateQueries({ queryKey: ["/api/ratings/received"] });
        setTimeout(() => setShowRating(false), 1500);
      },
      onError: (error: Error) => {
        if (error.message.includes("Already rated")) {
          toast({ title: "Già votato", description: "Hai già dato un voto a questo profilo.", variant: "destructive" });
        } else {
          toast({ title: "Errore", description: "Non è stato possibile inviare il voto.", variant: "destructive" });
        }
        setShowRating(false);
      },
    });
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
    
    const likeOpacity = useTransform(x, [0, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

    const handleDragStart = () => {
      dragDistanceRef.current = 0;
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
      dragDistanceRef.current = Math.abs(info.offset.x) + Math.abs(info.offset.y);
      if (info.offset.x > 100) {
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
      if (dragDistanceRef.current < 10 && isTop) {
        setShowDetail(true);
      }
    };

    return (
      <>
        <motion.div
          ref={ref}
          className="absolute w-full cursor-grab active:cursor-grabbing"
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
          <div className="relative rounded-2xl overflow-hidden bg-card shadow-2xl border border-card-border">
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={profile.imageUrl}
                alt={profile.name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={handleImageTap}
                data-testid={`profile-image-${profile.id}`}
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              
              <motion.div 
                className="absolute top-6 right-6 px-4 py-2 rounded-lg border-2 border-green-400 bg-green-400/20 backdrop-blur-sm pointer-events-none"
                style={{ opacity: likeOpacity }}
              >
                <span className="text-green-400 font-bold text-xl tracking-wider">LIKE</span>
              </motion.div>
              
              <motion.div 
                className="absolute top-6 left-6 px-4 py-2 rounded-lg border-2 border-red-400 bg-red-400/20 backdrop-blur-sm pointer-events-none"
                style={{ opacity: nopeOpacity }}
              >
                <span className="text-red-400 font-bold text-xl tracking-wider">NOPE</span>
              </motion.div>
              
              <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="secondary" className="bg-primary/80 text-primary-foreground backdrop-blur-sm">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {profile.alienType}
                  </Badge>
                  {hasPrivateRoom && (
                    <Badge variant="secondary" className="bg-amber-500/80 text-white backdrop-blur-sm" data-testid={`badge-private-room-${profile.id}`}>
                      <Lock className="w-3 h-3 mr-1" />
                      Stanza VIP
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
                
                <div className="flex items-center gap-1 text-white/80 mb-3">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{profile.location}</span>
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

            {profile.ratingEnabled && isTop && (
              <div className="absolute top-4 left-4 z-10">
                {!showRating ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    onClick={(e) => { e.stopPropagation(); setShowRating(true); setSelectedRating(null); setRatingSubmitted(false); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-500/90 to-purple-600/90 backdrop-blur-sm text-white text-xs font-semibold shadow-lg border border-white/20"
                    data-testid={`button-rate-${profile.id}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="flex flex-col items-start leading-tight">
                      <span>Prima Impressione</span>
                      <span className="text-[9px] font-normal text-white/70">Digli cosa pensi!</span>
                    </span>
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-black/80 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                    data-testid="rating-selector"
                  >
                    <p className="text-white/70 text-[10px] mb-2 text-center font-medium">Che impressione ti fa?</p>
                    <div className="flex flex-col gap-1">
                      {[
                        { value: 1, label: "Preferisco non pronunciarmi" },
                        { value: 2, label: "Non sei il mio tipo" },
                        { value: 3, label: "Qualcosa in te mi attrae" },
                        { value: 4, label: "Sei il mio tipo ideale" },
                        { value: 5, label: "Sei fantastico/a!" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedRating(opt.value)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all text-left ${
                            selectedRating === opt.value
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/80 hover:bg-white/20"
                          }`}
                          data-testid={`rating-${opt.value}`}
                        >
                          <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center shrink-0 text-[9px]">{opt.value}</span>
                          <span className="leading-tight">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => { setShowRating(false); setSelectedRating(null); }}
                        className="flex-1 py-1.5 rounded-lg bg-white/10 text-white/60 text-[10px] font-medium"
                        data-testid="button-cancel-rating"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => { if (selectedRating) ratingMutation.mutate(selectedRating); }}
                        disabled={!selectedRating || ratingMutation.isPending || ratingSubmitted}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-white text-[10px] font-medium disabled:opacity-50"
                        data-testid="button-submit-rating"
                      >
                        {ratingSubmitted ? "Inviato!" : ratingMutation.isPending ? "..." : "Invia"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>

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
}

export function ActionButtons({ onSwipeLeft, onSwipeRight, onSuperLike, disabled }: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-center gap-6 py-6">
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
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ boxShadow: "var(--glow-primary)" }}
        data-testid="button-swipe-right"
      >
        <Heart className="w-8 h-8 text-primary-foreground" />
      </motion.button>
    </div>
  );
}
